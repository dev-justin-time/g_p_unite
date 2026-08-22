// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FCMAgentRegistry.sol";

contract FCMTaskMarketplace is ReentrancyGuard {
    FCMAgentRegistry public registry;
    enum PricingModel { Spot, Reserved, Auction }
    enum TaskPriority { Low, Normal, High, Critical }

    struct Bid { bytes32 agentDid; uint256 price; uint256 timestamp; }
    struct AuctionTask {
        bytes32 taskId;
        uint256 minPrice;
        uint256 maxPrice;
        uint256 auctionEnd;
        uint256 auctionDuration;
        Bid[] bids;
    }

    mapping(bytes32 => AuctionTask) public auctionTasks;

    event SpotTaskListed(bytes32 indexed taskId, uint256 maxPrice, TaskPriority priority);
    event BidPlaced(bytes32 indexed taskId, bytes32 agentDid, uint256 price);
    event AuctionSettled(bytes32 indexed taskId, bytes32 winningAgent, uint256 price);

    constructor(address _registry) { registry = FCMAgentRegistry(_registry); }

    function listSpotTask(bytes32 _taskId, bytes32 _requirements, uint256 _maxPrice, uint256 _deadline, TaskPriority _priority) external {
        emit SpotTaskListed(_taskId, _maxPrice, _priority);
    }

    function listAuctionTask(bytes32 _taskId, bytes32 _requirements, uint256 _minPrice, uint256 _maxPrice, uint256 _auctionDuration) external {
        AuctionTask storage auction = auctionTasks[_taskId];
        auction.taskId = _taskId;
        auction.minPrice = _minPrice;
        auction.maxPrice = _maxPrice;
        auction.auctionEnd = block.timestamp + _auctionDuration;
        auction.auctionDuration = _auctionDuration;
    }

    function getAuctionPrice(bytes32 _taskId) public view returns (uint256) {
        AuctionTask storage auction = auctionTasks[_taskId];
        if (block.timestamp >= auction.auctionEnd) return auction.minPrice;
        uint256 elapsed = block.timestamp - (auction.auctionEnd - auction.auctionDuration);
        uint256 priceDrop = auction.maxPrice - auction.minPrice;
        return auction.maxPrice - ((priceDrop * elapsed) / auction.auctionDuration);
    }

    function placeBid(bytes32 _taskId, bytes32 _agentDid, uint256 _price) external {
        AuctionTask storage auction = auctionTasks[_taskId];
        require(block.timestamp < auction.auctionEnd, "Auction ended");
        require(_price <= getAuctionPrice(_taskId), "Price too high");
        auction.bids.push(Bid({agentDid: _agentDid, price: _price, timestamp: block.timestamp}));
        emit BidPlaced(_taskId, _agentDid, _price);
    }

    function settleAuction(bytes32 _taskId) external {
        AuctionTask storage auction = auctionTasks[_taskId];
        require(block.timestamp >= auction.auctionEnd, "Auction active");
        require(auction.bids.length > 0, "No bids");
        Bid memory bestBid = auction.bids[0];
        for (uint i = 1; i < auction.bids.length; i++) {
            if (auction.bids[i].price < bestBid.price) bestBid = auction.bids[i];
        }
        emit AuctionSettled(_taskId, bestBid.agentDid, bestBid.price);
    }
}
