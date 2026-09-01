require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const apiCallLogSchema = new mongoose.Schema(
  {
    project_id: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },
    username: { 
      type: String, 
      trim: true,
      index: true,
    }, // Extracted owner username (e.g. "aditya" from "aditya_proj1")

    path: { 
      type: String, 
      default: '',
      trim: true,
    },
    method: { 
      type: String, 
      default: 'GET',
      uppercase: true,
      trim: true,
    },

    timestamp: { 
      type: Date, 
      default: Date.now,
    },

    // Request metadata
    ip: { 
      type: String, 
      default: '',
      trim: true,
    },
    status: { 
      type: Number, 
      default: 200,
    },
    latency_ms: { 
      type: Number, 
      default: 0,
    },

    // Latency metrics breakdown
    team_latency: { 
      type: Number, 
      default: 0,
    },
    user_latency: { 
      type: Number, 
      default: 0,
    },
    total_latency: { 
      type: Number, 
      default: 0,
    },

    // Routing & cache flags
    private: { 
      type: Boolean, 
      default: false,
    },
    cache: { 
      type: String, 
      default: 'MISS',
      uppercase: true,
    },
    ttl: { 
      type: Number, 
      default: 0,
    },
  },
  { 
    timestamps: false,     // Explicit timestamp field used
    versionKey: false,     // Disable __v to save BSON size at 10k scale
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Primary dashboard timeline index (recent logs per project)
apiCallLogSchema.index({ project_id: 1, timestamp: -1 });

// 2. Endpoint-specific metric filtering & aggregation
apiCallLogSchema.index({ project_id: 1, method: 1, path: 1, timestamp: -1 });

// 3. User analytics timeline
apiCallLogSchema.index({ username: 1, timestamp: -1 });

// 4. Covered Index for latency stats aggregation (serviced entirely in RAM)
apiCallLogSchema.index({ project_id: 1, timestamp: -1, total_latency: 1, status: 1 });

// 5. Security & DoS query index
apiCallLogSchema.index({ project_id: 1, private: 1, ip: 1, timestamp: -1 });

// 6. TTL: Auto-delete log records older than 30 days
apiCallLogSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 30 * 24 * 3600,
});

module.exports = mongoose.models.ApiCallLog || mongoose.model('ApiCallLog', apiCallLogSchema);