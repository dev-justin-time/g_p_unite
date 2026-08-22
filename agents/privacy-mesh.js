export const privacyMesh = {
  id: 'priv',
  name: 'Privacy Mesh',
  icon: '🕵️',
  role: 'Mixnet routing & relay selection',
  status: 'active',
  rules: [
    { name: 'Onion Layer Encryption', enabled: true },
    { name: 'Sphinx Packet Format', enabled: true },
    { name: 'Cover Traffic Generation', enabled: true },
    { name: 'Reputation-Weighted Path', enabled: true },
    { name: 'Exit Policy Enforcement', enabled: true }
  ],
  metrics: [
    { key: 'relays', label: 'Relays', value: '1,247' },
    { key: 'latency', label: 'Hop Latency', value: '145ms' },
    { key: 'throughput', label: 'Aggregate', value: '2.1Gbps' }
  ],
  source: `// privacy-mesh.rs — Cryptographic mixnet, no routing LLM
use fcm_runtime::{Relay, ExitPolicy, SphinxPacket, NodePool};
use curve25519_dalek::scalar::Scalar;
use rand::rngs::OsRng;

pub struct PrivacyMesh {
    min_hops: usize,
    cover_traffic_ratio: f64,
    path_refresh_interval: Duration,
}

impl PrivacyMesh {
    /// Sphinx packet routing — pure cryptography
    pub fn build_circuit(&self, exit_policy: &ExitPolicy, pool: &NodePool) -> Result<Circuit, MeshError> {
        // Step 1: Filter relays by exit policy and capability
        let candidates: Vec<_> = pool.relays()
            .filter(|r| r.supports_exit_policy(exit_policy))
            .filter(|r| r.bandwidth_mbps > 10.0)
            .filter(|r| r.uptime > Duration::from_days(7))
            .collect();

        if candidates.len() < self.min_hops * 3 {
            return Err(MeshError::InsufficientRelays);
        }

        // Step 2: Reputation-weighted random sampling
        let entry = self.weighted_sample(&candidates, weight_fn: |r| r.bandwidth * r.reputation_score);

        let middle_candidates: Vec<_> = candidates.iter()
            .filter(|r| r.id != entry.id)
            .filter(|r| r.is_middle_relay)
            .collect();
        let middle = self.weighted_sample(&middle_candidates, weight_fn: |r| r.bandwidth * r.reputation_score);

        let exit_candidates: Vec<_> = candidates.iter()
            .filter(|r| r.id != entry.id && r.id != middle.id)
            .filter(|r| r.allows_exit_policy(exit_policy))
            .collect();
        let exit = self.weighted_sample(&exit_candidates, weight_fn: |r| r.bandwidth * r.reputation_score);

        // Step 3: Ensure geo-diversity (no two nodes in same /24)
        if !self.geo_diverse(&[entry.clone(), middle.clone(), exit.clone()]) {
            return self.build_circuit(exit_policy, pool); // Retry
        }

        // Step 4: Build Sphinx packet layers
        let circuit = Circuit::new(entry, middle, exit);
        let sphinx_packet = self.build_sphinx_layers(&circuit)?;

        Ok(circuit)
    }

    fn weighted_sample<F>(&self, candidates: &[Relay], weight_fn: F) -> Relay
    where F: Fn(&Relay) -> f64 {
        let weights: Vec<f64> = candidates.iter().map(weight_fn).collect();
        let total: f64 = weights.iter().sum();
        let mut rng = OsRng;
        let choice = rng.gen::<f64>() * total;

        let mut cumulative = 0.0;
        for (i, w) in weights.iter().enumerate() {
            cumulative += w;
            if cumulative >= choice {
                return candidates[i].clone();
            }
        }
        candidates.last().unwrap().clone()
    }

    fn geo_diverse(&self, relays: &[Relay]) -> bool {
        let subnets: Vec<_> = relays.iter()
            .map(|r| r.ip.octets()[0..3].to_vec())
            .collect();

        let unique: std::collections::HashSet<_> = subnets.iter().collect();
        unique.len() == relays.len()
    }

    fn build_sphinx_layers(&self, circuit: &Circuit) -> Result<SphinxPacket, MeshError> {
        let mut packet = SphinxPacket::new(self.payload.clone());

        // Layer 3: Exit node encryption
        packet.add_layer(&circuit.exit.public_key, routing: &circuit.exit.routing_info)?;

        // Layer 2: Middle node encryption
        packet.add_layer(&circuit.middle.public_key, routing: &circuit.middle.routing_info)?;

        // Layer 1: Entry node encryption
        packet.add_layer(&circuit.entry.public_key, routing: &circuit.entry.routing_info)?;

        Ok(packet)
    }

    pub fn generate_cover_traffic(&self, circuit: &Circuit) -> Vec<SphinxPacket> {
        let real_packets = self.traffic_estimate();
        let cover_count = (real_packets as f64 * self.cover_traffic_ratio) as usize;

        (0..cover_count)
            .map(|_| SphinxPacket::dummy(&mut OsRng))
            .collect()
    }
}

// Exit policy parser (deterministic, no NLP)
fn parse_exit_policy(policy_str: &str) -> ExitPolicy {
    let mut allowed_ports = Vec::new();
    let mut allowed_hosts = Vec::new();

    for line in policy_str.lines() {
        if line.starts_with("accept ") {
            let parts: Vec<_> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                allowed_hosts.push(parts[1].to_string());
                if parts.len() >= 3 {
                    allowed_ports.push(parse_port_range(parts[2]));
                }
            }
        }
    }

    ExitPolicy { allowed_ports, allowed_hosts }
}`,
  simulate() {
    const r = document.getElementById('priv-relays');
    if (r) r.textContent = (1240 + Math.floor(Math.random() * 20)).toLocaleString();
  },
  tick() {
    const r = document.getElementById('priv-relays');
    if (r) r.textContent = (1240 + Math.floor(Math.random() * 20)).toLocaleString();
  }
};
