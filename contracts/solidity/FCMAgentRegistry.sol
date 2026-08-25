// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract FCMAgentRegistry is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IERC20 public fcmToken;

    struct Agent {
        bytes32 didHash;
        string ipnsRecord;
        address operator;
        uint256 stake;
        uint256 reputation;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        bytes32 capabilities;
        bytes32 geohash;
        bool isActive;
        uint8 agentType;
        uint256 heartbeatNonce; // M-2: monotonic nonce prevents heartbeat prediction
    }

    struct Task {
        bytes32 taskId;
        address requester;
        uint256 reward;
        uint256 deadline;
        bytes32 requirements;
        bytes32 inputCID;
        bytes32 outputCID;
        address assignedAgent;
        TaskStatus status;
        bytes32 proofHash;
        bool rewardWithdrawn;
        uint256 disputedAt;
        bytes32 assignedDid; // L-5: DID that performed the task (survives unstake)
    }

    // M-6: Added Cancelled status for semantic clarity
    enum TaskStatus { Open, Assigned, Completed, Disputed, Slashed, Resolved, Cancelled }

    mapping(bytes32 => Agent) public agents;
    mapping(bytes32 => Task) public tasks;
    mapping(address => bytes32[]) public operatorAgents;
    mapping(bytes32 => uint256) public slashHistory;
    mapping(address => uint256) public operatorActiveTasks;

    bytes32[] public agentList;
    bytes32[] public taskList;

    uint256 public constant MIN_STAKE = 500 * 10**18;
    uint256 public constant HEARTBEAT_INTERVAL = 300;
    uint256 public constant SLASH_PERCENT = 3000;

    // L-5: Configurable dispute windows (admin-adjustable)
    uint256 public disputeWindow = 86400;            // 1 day default
    uint256 public disputeResolutionDeadline = 7 days; // 7 days default

    event AgentRegistered(bytes32 indexed didHash, address operator, uint8 agentType, bytes32 geohash);
    event AgentUpdated(bytes32 indexed didHash, uint256 reputation, bool isActive);
    event AgentReregistered(bytes32 indexed didHash, address operator, uint8 agentType);
    event TaskCreated(bytes32 indexed taskId, address requester, uint256 reward);
    event TaskAssigned(bytes32 indexed taskId, bytes32 indexed agentDid);
    event TaskCompleted(bytes32 indexed taskId, bytes32 outputCID, bytes32 proofHash);
    event TaskDisputed(bytes32 indexed taskId, address disputant, string reason);
    event AgentSlashed(bytes32 indexed didHash, uint256 amount, string reason);
    event Heartbeat(bytes32 indexed didHash, uint256 timestamp, bytes32 geohash);
    event TaskCancelled(bytes32 indexed taskId, address requester, uint256 refund);
    event DisputeExpired(bytes32 indexed taskId, address claimant, uint256 refund);
    event DisputeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    constructor(address _fcmToken) {
        fcmToken = IERC20(_fcmToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── L-1: Emergency pause ──
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ── L-5: Governance for dispute parameters ──
    function setDisputeWindow(uint256 _window) external onlyRole(ADMIN_ROLE) {
        require(_window >= 3600 && _window <= 604800, "Window must be 1h-7d");
        uint256 old = disputeWindow;
        disputeWindow = _window;
        emit DisputeWindowUpdated(old, _window);
    }

    function setDisputeResolutionDeadline(uint256 _deadline) external onlyRole(ADMIN_ROLE) {
        require(_deadline >= 86400 && _deadline <= 2592000, "Deadline must be 1d-30d");
        disputeResolutionDeadline = _deadline;
    }

    // ── Agent Registration ──
    // M-4: Allow re-registration after unstake (operator can register new DID)
    function registerAgent(
        bytes32 _didHash,
        string calldata _ipnsRecord,
        bytes32 _capabilities,
        bytes32 _geohash,
        uint8 _agentType
    ) external nonReentrant whenNotPaused {
        require(agents[_didHash].operator == address(0), "Agent exists");
        require(_agentType <= 12, "Invalid agent type (max 12)");
        require(fcmToken.transferFrom(msg.sender, address(this), MIN_STAKE), "Stake required");

        agents[_didHash] = Agent({
            didHash: _didHash,
            ipnsRecord: _ipnsRecord,
            operator: msg.sender,
            stake: MIN_STAKE,
            reputation: 5000,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            capabilities: _capabilities,
            geohash: _geohash,
            isActive: true,
            agentType: _agentType,
            heartbeatNonce: 0
        });

        operatorAgents[msg.sender].push(_didHash);
        agentList.push(_didHash);
        _grantRole(AGENT_ROLE, msg.sender);

        emit AgentRegistered(_didHash, msg.sender, _agentType, _geohash);
    }

    // ── M-2: Heartbeat with monotonic nonce ──
    function heartbeat(bytes32 _didHash, bytes32 _geohash, uint256 _nonce, bytes calldata _signature) external {
        Agent storage agent = agents[_didHash];
        require(agent.isActive, "Agent inactive");
        require(block.timestamp - agent.lastHeartbeat < HEARTBEAT_INTERVAL * 2, "Heartbeat expired");
        require(_nonce == agent.heartbeatNonce + 1, "Invalid nonce");

        bytes32 message = keccak256(abi.encodePacked(_didHash, _geohash, _nonce, block.timestamp));
        address signer = message.toEthSignedMessageHash().recover(_signature);
        require(signer == agent.operator, "Invalid signature");

        agent.lastHeartbeat = block.timestamp;
        agent.geohash = _geohash;
        agent.heartbeatNonce = _nonce;
        emit Heartbeat(_didHash, block.timestamp, _geohash);
    }

    // ── Task Lifecycle ──
    function createTask(bytes32 _taskId, bytes32 _requirements, bytes32 _inputCID, uint256 _deadline) external nonReentrant whenNotPaused {
        require(tasks[_taskId].requester == address(0), "Task ID already exists");
        require(_deadline > block.timestamp, "Invalid deadline");
        uint256 reward = calculateReward(_requirements);
        require(fcmToken.transferFrom(msg.sender, address(this), reward), "Reward escrow failed");

        tasks[_taskId] = Task({
            taskId: _taskId,
            requester: msg.sender,
            reward: reward,
            deadline: _deadline,
            requirements: _requirements,
            inputCID: _inputCID,
            outputCID: bytes32(0),
            assignedAgent: address(0),
            status: TaskStatus.Open,
            proofHash: bytes32(0),
            rewardWithdrawn: false,
            disputedAt: 0,
            assignedDid: bytes32(0)
        });

        taskList.push(_taskId);
        emit TaskCreated(_taskId, msg.sender, reward);
    }

    function claimTask(bytes32 _taskId, bytes32 _didHash) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        Agent storage agent = agents[_didHash];

        require(task.status == TaskStatus.Open, "Task not open");
        require(agent.isActive, "Agent inactive");
        require(agent.operator == msg.sender, "Not operator");
        require((agent.capabilities & task.requirements) == task.requirements, "Capability mismatch");
        require(block.timestamp < task.deadline, "Deadline passed");

        task.assignedAgent = msg.sender;
        task.assignedDid = _didHash;
        task.status = TaskStatus.Assigned;
        operatorActiveTasks[msg.sender]++;
        emit TaskAssigned(_taskId, _didHash);
    }

    function submitResult(bytes32 _taskId, bytes32 _outputCID, bytes32 _proofHash) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        require(task.assignedAgent == msg.sender, "Not assigned");
        require(task.status == TaskStatus.Assigned, "Not assigned");
        require(block.timestamp <= task.deadline, "Deadline passed");
        require(operatorActiveTasks[msg.sender] > 0, "No active tasks to submit");

        task.outputCID = _outputCID;
        task.proofHash = _proofHash;
        task.status = TaskStatus.Completed;
        operatorActiveTasks[msg.sender]--;
        emit TaskCompleted(_taskId, _outputCID, _proofHash);
    }

    function withdrawReward(bytes32 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        require(
            task.status == TaskStatus.Completed || task.status == TaskStatus.Resolved,
            "Not completed or resolved"
        );
        require(!task.rewardWithdrawn, "Reward already withdrawn");
        require(block.timestamp > task.deadline + disputeWindow, "Dispute window active");
        require(task.assignedAgent == msg.sender, "Not assignee");

        task.rewardWithdrawn = true;
        require(fcmToken.transfer(msg.sender, task.reward), "Transfer failed");

        // L-5: Credit the exact DID that performed the task — survives unstake
        bytes32 didHash = task.assignedDid;
        if (didHash != bytes32(0) && agents[didHash].operator != address(0)) {
            agents[didHash].reputation = min(agents[didHash].reputation + 100, 10000);
        }
    }

    // ── Disputes ──
    function disputeTask(bytes32 _taskId, string calldata _reason) external {
        require(bytes(_reason).length > 0, "Reason required");
        Task storage task = tasks[_taskId];
        require(task.requester == msg.sender, "Not requester");
        require(task.status == TaskStatus.Completed, "Not completed");
        require(block.timestamp <= task.deadline + disputeWindow, "Dispute window closed");

        task.status = TaskStatus.Disputed;
        task.disputedAt = block.timestamp;
        emit TaskDisputed(_taskId, msg.sender, _reason);
    }

    function resolveDispute(bytes32 _taskId, bool _agentFault, string calldata _resolution) external onlyRole(VALIDATOR_ROLE) {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");
        require(block.timestamp <= task.disputedAt + disputeResolutionDeadline, "Dispute deadline exceeded");

        if (_agentFault) {
            // L-5: slash the exact DID that performed the task — survives unstake
            bytes32 didHash = task.assignedDid;
            require(didHash != bytes32(0), "No assigned DID");
            uint256 slashAmount = (agents[didHash].stake * SLASH_PERCENT) / 10000;
            agents[didHash].stake -= slashAmount;
            agents[didHash].reputation = max(agents[didHash].reputation - 500, 0);
            task.status = TaskStatus.Slashed;
            slashHistory[didHash] += slashAmount;
            emit AgentSlashed(didHash, slashAmount, _resolution);
            require(fcmToken.transfer(task.requester, task.reward + slashAmount), "Transfer failed");
        } else {
            task.status = TaskStatus.Resolved;
            task.rewardWithdrawn = true;
            require(fcmToken.transfer(task.assignedAgent, task.reward), "Transfer failed");
        }
    }

    // ── Staking ──
    function unstake(bytes32 _didHash) external nonReentrant {
        Agent storage agent = agents[_didHash];
        require(agent.operator == msg.sender, "Not operator");
        require(agent.stake > 0, "No stake");
        require(operatorActiveTasks[msg.sender] == 0, "Active tasks");

        uint256 amount = agent.stake;
        agent.stake = 0;
        agent.isActive = false;
        require(fcmToken.transfer(msg.sender, amount), "Unstake failed");
    }

    // ── M-6: Dedicated Cancelled status ──
    function cancelTask(bytes32 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        require(task.requester == msg.sender, "Not requester");
        require(task.status == TaskStatus.Open, "Task not open");
        require(block.timestamp < task.deadline, "Deadline passed");

        task.status = TaskStatus.Cancelled;
        require(fcmToken.transfer(msg.sender, task.reward), "Refund failed");
        emit TaskCancelled(_taskId, msg.sender, task.reward);
    }

    function claimExpiredDispute(bytes32 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");
        require(task.disputedAt > 0, "No dispute timestamp");
        require(block.timestamp > task.disputedAt + disputeResolutionDeadline, "Dispute not expired");
        require(task.assignedAgent != address(0), "No assigned agent");
        require(
            task.requester == msg.sender || task.assignedAgent == msg.sender,
            "Not party to dispute"
        );

        task.status = TaskStatus.Slashed;
        require(fcmToken.transfer(task.requester, task.reward), "Refund failed");
        emit DisputeExpired(_taskId, msg.sender, task.reward);
    }

    // ── View Functions ──
    function getAgentOperator(bytes32 _didHash) external view returns (address) {
        return agents[_didHash].operator;
    }

    function getAgentStatus(bytes32 _didHash) external view returns (bool isActive, address operator) {
        Agent storage a = agents[_didHash];
        return (a.isActive, a.operator);
    }

    // M-5: Gas-safe two-pass getAgentsByType
    function getAgentsByType(uint8 _agentType) external view returns (bytes32[] memory) {
        // Pass 1: count matches
        uint256 count = 0;
        for (uint i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].agentType == _agentType && agents[agentList[i]].isActive) {
                count++;
            }
        }
        // Pass 2: fill exact-size array
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].agentType == _agentType && agents[agentList[i]].isActive) {
                result[idx++] = agentList[i];
            }
        }
        return result;
    }

    function calculateReward(bytes32 _requirements) public pure returns (uint256) {
        uint256 base = 100 * 10**18;
        uint256 complexity = uint256(_requirements) % 100;
        return base + (complexity * 10**18);
    }

    function findDidByOperator(address _operator) internal view returns (bytes32) {
        bytes32[] memory ops = operatorAgents[_operator];
        require(ops.length > 0, "No agent");
        for (uint i = ops.length; i > 0; i--) {
            if (agents[ops[i - 1]].isActive) return ops[i - 1];
        }
        revert("No active agent");
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
    function max(uint256 a, uint256 b) internal pure returns (uint256) { return a > b ? a : b; }
}
