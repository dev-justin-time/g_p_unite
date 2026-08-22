export const storageProvider = {
  id: 'storage',
  name: 'Storage Provider',
  icon: '💾',
  role: 'IPFS content storage and pinning',
  status: 'active',
  rules: [
    { name: 'Content Pinning', enabled: true },
    { name: 'Replication Factor', enabled: true },
    { name: 'Garbage Collection', enabled: true },
    { name: 'Deduplication', enabled: true },
    { name: 'Bandwidth Sharing', enabled: true }
  ],
  metrics: [
    { key: 'stored', label: 'Stored GB', value: '0' },
    { key: 'pins', label: 'Pinned', value: '0' },
    { key: 'served', label: 'Served GB', value: '0' }
  ],
  source: `// storage-provider.rs — IPFS content storage
use fcm_runtime::{Cid, StorageBackend, PinStatus};

pub struct StorageProvider {
    max_storage_gb: u64,
    used_storage_gb: u64,
    replication_factor: u32,
    gc_interval_secs: u64,
}

impl StorageProvider {
    pub fn pin_content(&mut self, cid: &Cid, size_bytes: u64) -> Result<PinStatus, StorageError> {
        let size_gb = size_bytes / (1024 * 1024 * 1024);

        // Check capacity
        if self.used_storage_gb + size_gb > self.max_storage_gb {
            return Err(StorageError::InsufficientSpace);
        }

        // Store to local IPFS node
        self.backend.pin(cid)?;
        self.used_storage_gb += size_gb;

        // Ensure replication
        for _ in 0..self.replication_factor - 1 {
            self.replicate_to_peer(cid)?;
        }

        Ok(PinStatus::Pinned)
    }

    pub fn gc_cycle(&mut self) {
        // Remove unpinned content older than threshold
        let unpinned = self.backend.list_unpinned();
        for cid in unpinned {
            if self.is_gc_eligible(&cid) {
                let size = self.backend.remove(&cid);
                self.used_storage_gb -= size / (1024 * 1024 * 1024);
            }
        }
    }

    pub fn calculate_earnings(&self, stored_gb: u64, served_gb: u64) -> f64 {
        let storage_reward = stored_gb as f64 * 0.05;  // 0.05 FCM/GB/month
        let serve_reward = served_gb as f64 * 0.02;    // 0.02 FCM/GB served
        storage_reward + serve_reward
    }
}`,
  simulate() {
    const s = document.getElementById('storage-stored');
    if (s) s.textContent = (parseInt(s.textContent) + 1) + '';
  },
  tick() {}
};
