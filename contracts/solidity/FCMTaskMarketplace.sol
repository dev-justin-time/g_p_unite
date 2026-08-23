// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FCMAgentRegistry.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract FCMTaskMarketplace is ReentrancyGuard, AccessControl {
    FCMAgentRegistry public registry;
    IERC20 public fcmToken;

    bytes32 public constant LISTING_ROLE = keccak256("LISTING_ROLE");

    enum PricingModel { Spot, Reserved, Auction }
    enum TaskPriority { Low, Normal, High, Critical }

    struct Bid {
        bytes32 agentDid;
        uint256 price;
        uint256 timestamp;
        bool withdrawn;
    }

    struct AuctionTask {
        bytes32 taskId;
        uint256 minPrice;
        uint256 maxPrice;
        uint256 auctionEnd;
        uint256 auctionDuration;
        Bid[] bids;
        bool settled;
        address lister;
    }

    mapping(bytes32 => AuctionTask) public auctionTasks;
    mapping(address => uint256) public escrowedBids;

    event SpotTaskListed(bytes32 indexed taskId, address indexed lister, uint256 maxPrice, TaskPriority priority);
    event AuctionListed(bytes32 indexed taskId, address indexed lister, uint256 minPrice, uint256 maxPrice, uint256 duration);
    event BidPlaced(bytes32 indexed taskId, bytes32 indexed agentDid, uint256 price);
    event AuctionSettled(bytes32 indexed taskId, bytes32 indexed winningAgent, uint256 price);
    event BidRefunded(bytes32 indexed taskId, address indexed agent, uint256 amount);

    constructor(address _registry, address _fcmToken) {
        registry = FCMAgentRegistry(_registry);
        fcmToken = IERC20(_fcmToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LISTING_ROLE, msg.sender);
    }

    function listSpotTask(
        bytes32 _taskId,
        bytes32 _requirements,
        uint256 _maxPrice,
        uint256 _deadline,
        TaskPriority _priority
    ) external nonReentrant {
        require(_maxPrice > 0, "Price must be > 0");
        require(_deadline > block.timestamp, "Invalid deadline");

        // Escrow the max price from the lister
        require(fcmToken.transferFrom(msg.sender, address(this), _maxPrice), "Escrow failed");

        emit SpotTaskListed(_taskId, msg.sender, _maxPrice, _priority);
    }

    function listAuctionTask(
        bytes32 _taskId,
        bytes32 _requirements,
        uint256 _minPrice,
        uint256 _maxPrice,
        uint256 _auctionDuration
    ) external nonReentrant {
        require(_minPrice > 0 && _maxPrice > _minPrice, "Invalid price range");
        require(_auctionDuration > 0 && _auctionDuration <= 86400, "Duration 1s-24h");

        // Escrow the max price
        require(fcmToken.transferFrom(msg.sender, address(this), _maxPrice), "Escrow failed");

        AuctionTask storage auction = auctionTasks[_taskId];
        auction.taskId = _taskId;
        auction.minPrice = _minPrice;
        auction.maxPrice = _maxPrice;
        auction.auctionEnd = block.timestamp + _auctionDuration;
        auction.auctionDuration = _auctionDuration;
        auction.lister = msg.sender;

        emit AuctionListed(_taskId, msg.sender, _minPrice, _maxPrice, _auctionDuration);
    }

    function getAuctionPrice(bytes32 _taskId) public view returns (uint256) {
        AuctionTask storage auction = auctionTasks[_taskId];
        if (block.timestamp >= auction.auctionEnd) return auction.minPrice;
        uint256 elapsed = block.timestamp - (auction.auctionEnd - auction.auctionDuration);
        uint256 priceDrop = auction.maxPrice - auction.minPrice;
        return auction.maxPrice - ((priceDrop * elapsed) / auction.auctionDuration);
    }

    function placeBid(bytes32 _taskId, bytes32 _agentDid, uint256 _price) external nonReentrant {
        AuctionTask storage auction = auctionTasks[_taskId];
        require(block.timestamp < auction.auctionEnd, "Auction ended");
        require(!auction.settled, "Already settled");
        require(_price <= getAuctionPrice(_taskId), "Price too high");
        require(_price >= auction.minPrice, "Below minimum");

        // Escrow the bid amount
        require(fcmToken.transferFrom(msg.sender, address(this), _price), "Bid escrow failed");
        escrowedBids[msg.sender] += _price;

        auction.bids.push(Bid({
            agentDid: _agentDid,
            price: _price,
            timestamp: block.timestamp,
            withdrawn: false
        }));

        emit BidPlaced(_taskId, _agentDid, _price);
    }

    function settleAuction(bytes32 _taskId) external nonReentrant {
        AuctionTask storage auction = auctionTasks[_taskId];
        require(block.timestamp >= auction.auctionEnd, "Auction active");
        require(auction.bids.length > 0, "No bids");
        require(!auction.settled, "Already settled");

        // Find lowest bid
        Bid memory bestBid = auction.bids[0];
        uint256 bestIdx = 0;
        for (uint i = 1; i < auction.bids.length; i++) {
            if (auction.bids[i].price < bestBid.price) {
                bestBid = auction.bids[i];
                bestIdx = i;
            }
        }

        auction.settled = true;

        // Refund all non-winning bids
        for (uint i = 0; i < auction.bids.length; i++) {
            if (i != bestIdx && !auction.bids[i].withdrawn) {
                // Find the bid's agent address from registry
                bytes32 did = auction.bids[i].agentDid;
                address agentAddr = registry.getAgentOperator(did);
                if (agentAddr != address(0)) {
                    uint256 refundAmount = auction.bids[i].price;
                    if (refundAmount > 0) {
                        fcmToken.transfer(agentAddr, refundAmount);
                        escrowedBids[agentAddr] -= refundAmount;
                        emit BidRefunded(_taskId, agentAddr, refundAmount);
                    }
                }
                auction.bids[i].withdrawn = true;
            }
        }

        // Mark winning bid as settled
        if (bestIdx < auction.bids.length) {
            auction.bids[bestIdx].withdrawn = true;
        }

        emit AuctionSettled(_taskId, bestBid.agentDid, bestBid.price);
    }

    function claimAuctionRefund(bytes32 _taskId, uint256 _bidIndex) external nonReentrant {
        AuctionTask storage auction = auctionTasks[_taskId];
        require(auction.settled, "Auction not settled");
        require(_bidIndex < auction.bids.length, "Invalid bid index");
        Bid storage bid = auction.bids[_bidIndex];
        require(!bid.withdrawn, "Already withdrawn");

        bytes32 did = bid.agentDid;
        require(registry.getAgentOperator(did) == msg.sender, "Not bid owner");

        bid.withdrawn = true;
        uint256 amount = bid.price;
        if (amount > 0) {
            escrowedBids[msg.sender] -= amount;
            fcmToken.transfer(msg.sender, amount);
        }

        emit BidRefunded(_taskId, msg.sender, amount);
    }
}
