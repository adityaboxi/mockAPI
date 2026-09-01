-- log_buffer.lua
-- OpenTelemetry Telemetry Logger for OpenResty Nginx Gateway
-- Batches logs and flushes asynchronously via HTTP to telemetry-server

local http = require("resty.http")
local cjson = require("cjson.safe")

local _M = {}

-- ---------- CONFIGURATION ----------
local LOG_SERVER_URL = os.getenv("LOG_SERVER_URL") or "http://telemetry-server:3003/v1/logs"
local CONTAINER_NAME = os.getenv("CONTAINER_NAME") or "nginx-gateway"
local MAX_QUEUE_SIZE = 5000       -- Max logs in memory (~1 MB)
local BATCH_INTERVAL = 3          -- Flush interval in seconds
local HTTP_TIMEOUT   = 2000       -- 2 seconds HTTP timeout (non-blocking)

-- Each worker process has its own independent buffer.
local buffer = {}
local flush_timer = nil
local is_flushing = false

-- ---------- FLUSH IMPLEMENTATION ----------
local function do_flush()
    if #buffer == 0 then
        return
    end

    -- Atomic swap: copy current buffer and reset queue
    local batch = buffer
    buffer = {}

    -- Send batch to telemetry server via non-blocking cosocket
    local httpc = http.new()
    httpc:set_timeout(HTTP_TIMEOUT)

    local json_body, json_err = cjson.encode(batch)
    if not json_body then
        ngx.log(ngx.WARN, "[log_buffer] Failed to encode logs to JSON: ", json_err)
        return
    end

    local res, err = httpc:request_uri(LOG_SERVER_URL, {
        method = "POST",
        body = json_body,
        headers = {
            ["Content-Type"] = "application/json",
            ["User-Agent"] = "OpenResty-Nginx-Gateway/1.0",
        },
    })

    if not res or (res.status < 200 or res.status >= 300) then
        -- Silently drop on failure to prevent memory leaks and blocking
        -- ngx.log(ngx.WARN, "[log_buffer] Telemetry flush failed: ", err or res.status)
    end
end

-- Timer callback wrapper
local function flush_timer_handler(premature)
    if premature then
        -- Worker is exiting: attempt a fast final flush
        do_flush()
        return
    end

    if is_flushing then
        return
    end

    is_flushing = true
    pcall(do_flush)
    is_flushing = false
end

-- Async early flush trigger for high load
local function trigger_early_flush()
    if is_flushing then
        return
    end
    -- Schedule immediate 0s async timer to avoid blocking log_by_lua phase
    local ok, err = ngx.timer.at(0, flush_timer_handler)
    if not ok and err ~= "process exiting" then
        -- Timer pool exhausted under heavy load; drops silently
    end
end

-- ---------- ADD LOG ENTRY TO BUFFER ----------
function _M.log(entry)
    local log_entry = {
        time = ngx.now() * 1000,
        container = CONTAINER_NAME,
        level = entry.level or "INFO",
        message = entry.message or "",
        method = entry.method or "GET",
        uri = entry.uri or "/",
        status = entry.status or 200,
        client_ip = entry.client_ip or "",
        upstream_addr = entry.upstream_addr or "",
        request_time = entry.request_time or 0,
    }

    -- Bounded queue protection: drop oldest if buffer is completely saturated
    if #buffer >= MAX_QUEUE_SIZE then
        table.remove(buffer, 1)
    end

    table.insert(buffer, log_entry)

    -- Trigger early async flush if buffer reaches 50% capacity
    if #buffer >= math.floor(MAX_QUEUE_SIZE / 2) then
        trigger_early_flush()
    end
end

-- ---------- INIT TIMER (called once per worker in init_worker_by_lua) ----------
function _M.init_timer()
    if flush_timer then
        return
    end

    local ok, err = ngx.timer.every(BATCH_INTERVAL, flush_timer_handler)
    if not ok then
        ngx.log(ngx.ERR, "[log_buffer] Failed to create flush timer: ", err)
    else
        flush_timer = true
    end
end

-- ---------- FLUSH ON WORKER EXIT ----------
local old_exit = ngx.worker.exit
ngx.worker.exit = function(code)
    pcall(do_flush)
    if old_exit then
        old_exit(code)
    end
end

return _M