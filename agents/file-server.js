export const fileServer = {
  id: 'file_server',
  name: 'File Server',
  icon: '📁',
  role: 'HTTP file hosting and CDN edge caching',
  status: 'active',
  rules: [
    { name: 'TLS Termination', enabled: true },
    { name: 'Cache Control', enabled: true },
    { name: 'Rate Limiting', enabled: true },
    { name: 'Access Logging', enabled: true },
    { name: 'Bandwidth Throttle', enabled: true }
  ],
  metrics: [
    { key: 'files', label: 'Files', value: '0' },
    { key: 'requests', label: 'Requests', value: '0' },
    { key: 'bandwidth', label: 'BW Used', value: '0 GB' }
  ],
  source: `// file-server.rs — HTTP file hosting
use fcm_runtime::{FileServer, Request, Response};
use std::path::PathBuf;

pub struct FCMFileServer {
    root: PathBuf,
    max_connections: u32,
    max_bandwidth_mbps: u32,
    cache_enabled: bool,
    tls_enabled: bool,
}

impl FCMFileServer {
    pub fn handle_request(&self, req: Request) -> Result<Response, ServerError> {
        // Rate limit check
        if self.is_rate_limited(&req.client_ip) {
            return Err(ServerError::RateLimited);
        }

        // Connection limit
        if self.active_connections() >= self.max_connections {
            return Err(ServerError::TooManyConnections);
        }

        // Resolve file path
        let path = self.sanitize_path(&req.path)?;
        let file = self.root.join(&path);

        if !file.exists() {
            return Err(ServerError::NotFound);
        }

        // Check cache
        if self.cache_enabled {
            if let Some(cached) = self.cache_get(&path) {
                return Ok(cached);
            }
        }

        // Serve file
        let response = Response::from_file(&file)?;

        // Log access
        self.log_access(&req, &response);

        // Update earnings
        self.record_bytes_served(response.body.len() as u64);

        Ok(response)
    }

    pub fn calculate_earnings(&self) -> f64 {
        let bytes = self.total_bytes_served();
        let gb = bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let requests = self.total_requests() as f64;

        let bandwidth_reward = gb * 0.02;     // 0.02 FCM/GB
        let request_reward = requests * 0.001; // 0.001 FCM/request
        bandwidth_reward + request_reward
    }
}`,
  simulate() {
    const r = document.getElementById('file_server-requests');
    if (r) r.textContent = (parseInt(r.textContent) + Math.floor(Math.random() * 10)) + '';
  },
  tick() {}
};
