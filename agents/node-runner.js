export const nodeRunner = {
  id: 'node',
  name: 'Node Runner',
  icon: '🖥️',
  role: 'General compute node — handles any task type',
  status: 'active',
  rules: [
    { name: 'Auto-Claim Tasks', enabled: true },
    { name: 'Load Balancing', enabled: true },
    { name: 'Health Monitoring', enabled: true },
    { name: 'Capability Matching', enabled: true },
    { name: 'Reward Optimization', enabled: true }
  ],
  metrics: [
    { key: 'tasks', label: 'Tasks Done', value: '0' },
    { key: 'uptime', label: 'Uptime', value: '0h' },
    { key: 'earnings', label: 'Earned', value: '0 FCM' }
  ],
  source: `// node-runner.rs — General compute node
use fcm_runtime::{Task, NodePool, Capability};

pub struct NodeRunner {
    max_concurrent: usize,
    auto_claim: bool,
    capability_filter: Vec<Capability>,
}

impl NodeRunner {
    pub fn accept_task(&self, task: &Task) -> bool {
        if !self.auto_claim { return false; }
        if task.assigned_agent.is_some() { return false; }

        // Match capabilities
        let has_caps = self.capability_filter.iter()
            .all(|cap| task.required_capabilities.contains(cap));

        // Check resource availability
        let available = self.check_resources(&task.resource_requirements);
        has_caps && available
    }

    fn check_resources(&self, req: &ResourceReq) -> bool {
        let usage = get_system_usage();
        usage.cpu_free_pct > 20.0
            && usage.mem_free_gb > req.min_memory_gb as f64
            && usage.disk_free_gb > req.min_disk_gb as f64
    }
}`,
  simulate() {
    const t = document.getElementById('node-tasks');
    if (t) t.textContent = parseInt(t.textContent) + 1;
  },
  tick() {
    const u = document.getElementById('node-uptime');
    if (u) {
      const hrs = parseInt(u.textContent) || 0;
      u.textContent = (hrs + 1) + 'h';
    }
  }
};
