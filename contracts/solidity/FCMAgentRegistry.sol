// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract FCMAgentRegistry is AccessControl, ReentrancyGuard {
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
    }

    enum TaskStatus { Open, Assigned, Completed, Disputed, Slashed }

    mapping(bytes32 => Agent) public agents;
    mapping(bytes32 => Task) public tasks;
    mapping(address => bytes32[]) public operatorAgents;
    mapping(bytes32 => uint256) public slashHistory;

    bytes32[] public agentList;
    bytes32[] public taskList;

    uint256 public constant MIN_STAKE = 500 * 10**18;
    uint256 public constant HEARTBEAT_INTERVAL = 300;
    uint256 public constant DISPUTE_WINDOW = 86400;
    uint256 public constant SLASH_PERCENT = 3000;

    event AgentRegistered(bytes32 indexed didHash, address operator, uint8 agentType, bytes32 geohash);
    event AgentUpdated(bytes32 indexed didHash, uint256 reputation, bool isActive);
    event TaskCreated(bytes32 indexed taskId, address requester, uint256 reward);
    event TaskAssigned(bytes32 indexed taskId, bytes32 indexed agentDid);
    event TaskCompleted(bytes32 indexed taskId, bytes32 outputCID, bytes32 proofHash);
    event TaskDisputed(bytes32 indexed taskId, address disputant, string reason);
    event AgentSlashed(bytes32 indexed didHash, uint256 amount, string reason);
    event Heartbeat(bytes32 indexed didHash, uint256 timestamp, bytes32 geohash);

    constructor(address _fcmToken) {
        fcmToken = IERC20(_fcmToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerAgent(
        bytes32 _didHash,
        string calldata _ipnsRecord,
        bytes32 _capabilities,
        bytes32 _geohash,
        uint8 _agentType
    ) external nonReentrant {
        require(agents[_didHash].operator == address(0), "Agent exists");
        require(_agentType <= 7, "Invalid agent type");
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
            agentType: _agentType
        });

        operatorAgents[msg.sender].push(_didHash);
        agentList.push(_didHash);
        _grantRole(AGENT_ROLE, msg.sender);

        emit AgentRegistered(_didHash, msg.sender, _agentType, _geohash);
    }

    function heartbeat(bytes32 _didHash, bytes32 _geohash, bytes calldata _signature) external {
        Agent storage agent = agents[_didHash];
        require(agent.isActive, "Agent inactive");
        require(block.timestamp - agent.lastHeartbeat < HEARTBEAT_INTERVAL * 2, "Heartbeat expired");

        bytes32 message = keccak256(abi.encodePacked(_didHash, _geohash, block.timestamp));
        address signer = message.toEthSignedMessageHash().recover(_signature);
        require(signer == agent.operator, "Invalid signature");

        agent.lastHeartbeat = block.timestamp;
        agent.geohash = _geohash;
        emit Heartbeat(_didHash, block.timestamp, _geohash);
    }

    function createTask(bytes32 _taskId, bytes32 _requirements, bytes32 _inputCID, uint256 _deadline) external nonReentrant {
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
            rewardWithdrawn: false
        });

        taskList.push(_taskId);
        emit TaskCreated(_taskId, msg.sender, reward);
    }

    function claimTask(bytes32 _taskId, bytes32 _didHash) external nonReentrant {
        Task storage task = tasks[_taskId];
        Agent storage agent = agents[_didHash];

        require(task.status == TaskStatus.Open, "Task not open");
        require(agent.isActive, "Agent inactive");
        require(agent.operator == msg.sender, "Not operator");
        require((agent.capabilities & task.requirements) == task.requirements, "Capability mismatch");
        require(block.timestamp < task.deadline, "Deadline passed");

        task.assignedAgent = msg.sender;
        task.status = TaskStatus.Assigned;
        emit TaskAssigned(_taskId, _didHash);
    }

    function submitResult(bytes32 _taskId, bytes32 _outputCID, bytes32 _proofHash) external nonReentrant {
        Task storage task = tasks[_taskId];
        require(task.assignedAgent == msg.sender, "Not assigned");
        require(task.status == TaskStatus.Assigned, "Not assigned");
        require(block.timestamp <= task.deadline, "Deadline passed");

        task.outputCID = _outputCID;
        task.proofHash = _proofHash;
        task.status = TaskStatus.Completed;
        emit TaskCompleted(_taskId, _outputCID, _proofHash);
    }

    function withdrawReward(bytes32 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Completed, "Not completed");
        require(!task.rewardWithdrawn, "Reward already withdrawn");
        require(block.timestamp > task.deadline + DISPUTE_WINDOW, "Dispute window active");
        require(task.assignedAgent == msg.sender, "Not assignee");

        task.rewardWithdrawn = true;
        require(fcmToken.transfer(msg.sender, task.reward), "Transfer failed");

        bytes32 didHash = findDidByOperator(msg.sender);
        agents[didHash].reputation = min(agents[didHash].reputation + 100, 10000);
    }

    function disputeTask(bytes32 _taskId, string calldata _reason) external {
        Task storage task = tasks[_taskId];
        require(task.requester == msg.sender, "Not requester");
        require(task.status == TaskStatus.Completed, "Not completed");
        require(block.timestamp <= task.deadline + DISPUTE_WINDOW, "Dispute window closed");

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(_taskId, msg.sender, _reason);
    }

    function resolveDispute(bytes32 _taskId, bool _agentFault, string calldata _resolution) external onlyRole(VALIDATOR_ROLE) {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");

        if (_agentFault) {
            bytes32 didHash = findDidByOperator(task.assignedAgent);
            uint256 slashAmount = (agents[didHash].stake * SLASH_PERCENT) / 10000;
            agents[didHash].stake -= slashAmount;
            agents[didHash].reputation = max(agents[didHash].reputation - 500, 0);
            require(fcmToken.transfer(task.requester, task.reward + slashAmount), "Transfer failed");
            task.status = TaskStatus.Slashed;
            slashHistory[didHash] += slashAmount;
            emit AgentSlashed(didHash, slashAmount, _resolution);
        } else {
            require(fcmToken.transfer(task.assignedAgent, task.reward), "Transfer failed");
            task.status = TaskStatus.Completed;
        }
    }

    function unstake(bytes32 _didHash) external nonReentrant {
        Agent storage agent = agents[_didHash];
        require(agent.operator == msg.sender, "Not operator");
        require(agent.stake > 0, "No stake");

        bool hasActive = false;
        for (uint i = 0; i < taskList.length; i++) {
            if (tasks[taskList[i]].assignedAgent == msg.sender && tasks[taskList[i]].status == TaskStatus.Assigned) {
                hasActive = true;
                break;
            }
        }
        require(!hasActive, "Active tasks");

        uint256 amount = agent.stake;
        agent.stake = 0;
        agent.isActive = false;
        require(fcmToken.transfer(msg.sender, amount), "Unstake failed");
    }

    function getAgentsByType(uint8 _agentType) external view returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](agentList.length);
        uint256 count = 0;
        for (uint i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].agentType == _agentType && agents[agentList[i]].isActive) {
                result[count++] = agentList[i];
            }
        }
        assembly { mstore(result, count) }
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
        return ops[ops.length - 1];
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
    function max(uint256 a, uint256 b) internal pure returns (uint256) { return a > b ? a : b; }
}
