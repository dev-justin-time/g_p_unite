export const agentCoordinator = {
  id: 'coord',
  name: 'Agent Coordinator',
  icon: '🤝',
  role: 'Onboarding support & inter-agent coordination',
  status: 'active',
  rules: [
    { name: 'New Agent Onboarding', enabled: true },
    { name: 'Capability Matching', enabled: true },
    { name: 'Load Balancing', enabled: true },
    { name: 'Health Monitoring', enabled: true },
    { name: 'Fallback Routing', enabled: true }
  ],
  metrics: [
    { key: 'onboarded', label: 'Onboarded', value: '1,247' },
    { key: 'active', label: 'Coordinated', value: '89' },
    { key: 'uptime', label: 'Network Uptime', value: '99.7%' }
  ],
  source: `// agent-coordinator.rs — Multi-agent orchestration and onboarding
use fcm_contracts::{AgentRegistry, Agent, Capability};

pub struct AgentCoordinator {
    max_concurrent_tasks: u32,
    health_check_interval: u64,
    onboarding_steps: Vec<OnboardingStep>,
}

impl AgentCoordinator {
    /// Guide new agent through onboarding
    pub fn onboard_agent(
        &self,
        registry: &mut AgentRegistry,
        config: &AgentConfig,
    ) -> OnboardingResult {
        let mut steps = vec![];

        // Step 1: Validate hardware requirements
        let hw_check = self.validate_hardware(&config.hardware);
        steps.push(("hardware", hw_check.passed, hw_check.details));
        if !hw_check.passed {
            return OnboardingResult::Failed("Hardware below minimum".into());
        }

        // Step 2: Check network connectivity
        let net_check = self.validate_network(&config.rpc_url);
        steps.push(("network", net_check.passed, net_check.details));

        // Step 3: Verify stake amount
        let stake_check = self.validate_stake(
            config.stake_amount,
            config.agent_type,
            &config.tier_config,
        );
        steps.push(("stake", stake_check.passed, stake_check.details));

        // Step 4: Generate DID and capabilities
        let did = generate_did(&config.operator);
        let caps = self.compute_capabilities(&config.hardware);
        steps.push(("did", true, format!("DID: {}", did)));

        // Step 5: Register on-chain
        let reg_result = registry.register_agent(
            did, &config.ipns_record, caps, &config.geohash, config.agent_type,
        );
        steps.push(("register", reg_result.is_ok(), reg_result.map_err(|e| e.to_string()).unwrap_or_default()));

        OnboardingResult::Success {
            did,
            capabilities: caps,
            steps,
            estimated_earnings: self.estimate_earnings(config.agent_type, 0),
        }
    }

    /// Match task to best available agent
    pub fn match_task(
        &self,
        task: &Task,
        agents: &[Agent],
    ) -> Option<MatchResult> {
        let candidates: Vec<_> = agents.iter()
            .filter(|a| a.is_active)
            .filter(|a| a.capabilities & task.requirements == task.requirements)
            .filter(|a| a.operator_active_tasks < self.max_concurrent_tasks as u64)
            .filter(|a| a.last_heartbeat > current_timestamp() - 600)
            .collect();

        if candidates.is_empty() {
            // Fallback: find agent with closest capabilities
            let fallback = agents.iter()
                .filter(|a| a.is_active)
                .min_by_key(|a| self.capability_distance(a.capabilities, task.requirements));

            return fallback.map(|a| MatchResult {
                agent: a.clone(),
                confidence: 0.7, // Lower confidence for fallback
                reason: "Fallback match".into(),
            });
        }

        // Score candidates: reputation * tier_multiplier / load
        let best = candidates.iter()
            .max_by_key(|a| {
                let rep_score = a.reputation as u128;
                let tier_mult = self.tier_multiplier(a.current_tier) as u128;
                let load_factor = 1000 / (a.operator_active_tasks.max(1) as u128);
                rep_score * tier_mult * load_factor / 100
            })
            .unwrap();

        Some(MatchResult {
            agent: best.clone(),
            confidence: 1.0,
            reason: "Best match".into(),
        })
    }

    /// Monitor agent health and detect failures
    pub fn check_health(&self, agents: &[Agent]) -> Vec<HealthAlert> {
        let now = current_timestamp();
        agents.iter()
            .filter(|a| a.is_active)
            .filter_map(|a| {
                let heartbeat_age = now.saturating_sub(a.last_heartbeat);
                if heartbeat_age > 600 {
                    Some(HealthAlert {
                        agent: a.did_hash,
                        issue: HealthIssue::HeartbeatExpired,
                        severity: if heartbeat_age > 1800 { Severity::Critical }
                                  else { Severity::Warning },
                        hours_since_heartbeat: heartbeat_age / 3600,
                    })
                } else if a.stake < a.required_stake {
                    Some(HealthAlert {
                        agent: a.did_hash,
                        issue: HealthIssue::InsufficientStake,
                        severity: Severity::Critical,
                        hours_since_heartbeat: 0,
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    fn capability_distance(&self, have: u64, need: u64) -> u32 {
        (have ^ need).count_ones()
    }

    fn tier_multiplier(&self, tier: u8) -> u32 {
        [1, 1, 15, 2, 3, 5][tier as usize] * 10
    }
}`,
  simulate() {
    const o = document.getElementById('coord-onboarded');
    if (o && Math.random() > 0.8) { o.textContent = (1247 + Math.floor(Math.random() * 3)).toLocaleString(); }
    const u = document.getElementById('coord-uptime');
    if (u) { u.textContent = (99.5 + Math.random() * 0.5).toFixed(1) + '%'; }
  },
  tick() {
    const u = document.getElementById('coord-uptime');
    if (u) u.textContent = (99.5 + Math.random() * 0.5).toFixed(1) + '%';
  }
};
