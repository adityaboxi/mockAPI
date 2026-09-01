-- log_buffer.lua
-- This is the Lua version of your universal-logger.js
-- It batches logs and sends them via HTTP to telemetry-server.

local http = require("resty.http")
local cjson = require("cjson")

local _M = {}


-- ---------- CONFIGURATION ----------
local LOG_SERVER_URL = os.getenv("LOG_SERVER_URL") or "http://telemetry-server:3003/v1/logs"
local CONTAINER_NAME = os.getenv("CONTAINER_NAME") or "nginx-gateway"
local MAX_QUEUE_SIZE = 1000      -- Max logs in memory (~200 KB)
local BATCH_INTERVAL = 3         -- Flush every 3 seconds

-- Each worker process has its own independent buffer.
local buffer = {}
local flush_timer = nil

-- ---------- FLUSH FUNCTION (Sends batch to server) ----------
local function flush()
    if #buffer == 0 then
        return
    end

    -- Take a copy of the queue and clear it immediately
    local batch = buffer
    buffer = {}

    -- Send the batch in ONE HTTP request
    local httpc = http.new()
    httpc:set_timeout(2000)  -- 2 second timeout (non-blocking)

    local res, err = httpc:request_uri(LOG_SERVER_URL, {
        method = "POST",
        body = cjson.encode(batch),  -- Sends an ARRAY of logs
        headers = {
            ["Content-Type"] = "application/json",
        }
    })

    -- Silently drop logs if the server is down.
    if not res or res.status ~= 200 then
        -- Uncomment for debugging:
        -- ngx.log(ngx.ERR, "Failed to send logs: ", err or res.status)
    end
end

-- ---------- ADD LOG TO BUFFER ----------
function _M.log(entry)
    -- Build log entry with timestamp and container name
    local log_entry = {
        time = ngx.now() * 1000,  -- milliseconds (matches JavaScript Date.now())
        container = CONTAINER_NAME,
        level = entry.level or "INFO",
        message = entry.message or "",
        method = entry.method,
        uri = entry.uri,
        status = entry.status,
        client_ip = entry.client_ip,
        upstream_addr = entry.upstream_addr,
        request_time = entry.request_time,
    }

    -- ---------- BOUNDED QUEUE LOGIC (Memory Safety) ----------
    if #buffer >= MAX_QUEUE_SIZE then
        table.remove(buffer, 1)  -- Remove oldest
    end

    table.insert(buffer, log_entry)

    -- Early flush if queue is half full
    if #buffer >= MAX_QUEUE_SIZE / 2 then
        flush()
    end
end

-- ---------- INIT TIMER (called once per worker) ----------
function _M.init_timer()
    if flush_timer then
        return
    end

    flush_timer = ngx.timer.every(BATCH_INTERVAL, function()
        flush()
        return true
    end)
end

-- ---------- FLUSH ON WORKER EXIT ----------
local old_exit = ngx.worker.exit
ngx.worker.exit = function(code)
    flush()
    old_exit(code)
end

return _M