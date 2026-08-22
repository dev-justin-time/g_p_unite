export const flCoordinator = {
  id: 'fl',
  name: 'FL Coordinator',
  icon: '🔒',
  role: 'Secure aggregation & privacy',
  status: 'active',
  rules: [
    { name: 'Differential Privacy (ε=1.0)', enabled: true },
    { name: 'Secure Aggregation (MPC)', enabled: true },
    { name: 'Gradient Clipping (L2=1.0)', enabled: true },
    { name: 'Byzantine Fault Tolerance', enabled: true },
    { name: 'Model Poisoning Detection', enabled: true }
  ],
  metrics: [
    { key: 'rounds', label: 'Rounds', value: '42' },
    { key: 'nodes', label: 'Hospitals', value: '156' },
    { key: 'accuracy', label: 'Accuracy', value: '94.2%' }
  ],
  source: `// fl-coordinator.rs — Cryptographic privacy, no LLM trust
use fcm_runtime::{EncryptedGradient, ModelUpdate, MPCContext};
use rand::rngs::OsRng;

pub struct FLCoordinator {
    epsilon: f64,          // DP budget
    l2_norm_clip: f32,     // Gradient clipping threshold
    byzantine_threshold: f64, // Fraction of malicious nodes tolerated
}

impl FLCoordinator {
    /// Pure cryptographic aggregation — zero AI/LLM in trust path
    pub fn aggregate_round(&self, gradients: Vec<EncryptedGradient>) -> Result<ModelUpdate, FLError> {
        // Step 1: Validate gradient shapes and signatures
        let valid = gradients.into_iter()
            .filter(|g| self.verify_signature(g))
            .filter(|g| self.verify_shape(g))
            .collect::<Vec<_>>();

        if valid.len() < gradients.len() / 2 {
            return Err(FLError::InsufficientHonestNodes);
        }

        // Step 2: L2 clipping (privacy + robustness)
        let clipped: Vec<_> = valid.iter()
            .map(|g| self.l2_clip(g, self.l2_norm_clip))
            .collect();

        // Step 3: Differential privacy — Gaussian mechanism
        let noised: Vec<_> = clipped.iter()
            .map(|g| self.add_gaussian_noise(g, self.epsilon))
            .collect();

        // Step 4: Secure Multi-Party Computation sum
        // No single party sees individual gradients
        let aggregated = self.mpc_sum(noised, threshold: valid.len() / 2 + 1)?;

        // Step 5: Byzantine-robust aggregation (Krum / trimmed mean)
        let robust_update = self.byzantine_robust_aggregate(aggregated);

        // Step 6: Model poisoning detection (statistical test)
        if self.detect_poisoning(&robust_update) {
            return Err(FLError::PoisoningDetected);
        }

        Ok(robust_update)
    }

    fn l2_clip(&self, gradient: &Gradient, max_norm: f32) -> Gradient {
        let norm = gradient.l2_norm();
        if norm > max_norm {
            gradient.scale(max_norm / norm)
        } else {
            gradient.clone()
        }
    }

    fn add_gaussian_noise(&self, gradient: &Gradient, epsilon: f64) -> Gradient {
        let sensitivity = self.l2_norm_clip; // Global sensitivity from clipping
        let sigma = sensitivity * (2.0 * (1.25f64.ln()) / epsilon).sqrt();
        gradient.add_noise(GaussianNoise::new(sigma, &mut OsRng))
    }

    fn byzantine_robust_aggregate(&self, gradients: Vec<Gradient>) -> Gradient {
        // Coordinate-wise trimmed mean (removes top/bottom 10%)
        let trim_ratio = 0.1;
        let n = gradients.len();
        let trim_count = (n as f64 * trim_ratio) as usize;

        gradients.coordinate_wise_median()
            .trimmed_mean(trim_count)
    }

    fn detect_poisoning(&self, update: &ModelUpdate) -> bool {
        // Statistical outlier detection (Mahalanobis distance)
        let historical = self.update_history.last_n(10);
        let mean = historical.mean();
        let cov = historical.covariance();
        let distance = update.mahalanobis_distance(&mean, &cov);

        distance > 3.0 // 3-sigma rule
    }
}

// MPC using Shamir Secret Sharing
fn mpc_sum(shares: Vec<EncryptedGradient>, threshold: usize) -> Result<Gradient, MPCError> {
    let combined = shamir_reconstruct(shares, threshold)?;
    Ok(combined)
}`,
  simulate() {
    const r = document.getElementById('fl-rounds');
    if (r) r.textContent = parseInt(r.textContent) + 1;
  },
  tick() {}
};
