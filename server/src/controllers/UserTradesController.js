

import UserTrade from '../models/UserTrades.Modal.js';
import User from '../models/User.js';

// Function to open a new trade (position)
export const openTrade = async (userId, tradeData) => {
    try {
        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found.');
        }

        // Create a new trade
        const newTrade = new UserTrade({
            ...tradeData,
            openTime: new Date(),
            status: 'Active',
        });

        // Save the trade
        await newTrade.save();

        // Link the trade to the user
        user.trades.push(newTrade._id);
        await user.save();

        console.log('Trade opened:', newTrade);
        return newTrade;
    } catch (error) {
        console.error('Error opening trade:', error.message);
        throw error;
    }
};

// Function to close an active trade (position)
export const closeTrade = async (userId, tradeId, closePrice) => {
    try {
        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found.');
        }

        // Find the trade and ensure it belongs to the user
        const trade = await UserTrade.findById(tradeId);
        if (!trade || trade.status === 'Closed' || !user.trades.includes(tradeId)) {
            throw new Error('Trade not found or unauthorized to close.');
        }

        // Calculate PnL
        const pnl = (closePrice - trade.openPrice) * trade.volume;

        // Update trade details
        trade.closePrice = closePrice;
        trade.closeTime = new Date();
        trade.pnl = pnl;
        trade.status = 'Closed';
        await trade.save();

        return trade;
    } catch (error) {
        console.error('Error closing trade:', error.message);
        throw error;
    }
};


// Function to get the trade history for a specific user
export const getTradeHistory = async (userId) => {
    try {
        // Find the user and populate their trades
        const user = await User.findById(userId).populate('trades');
        if (!user || !user.trades || user.trades.length === 0) {
            throw new Error('No trades found for this user.');
        }

        // console.log('Trade history:', user.trades);
        return user.trades;
    } catch (error) {
        console.error('Error fetching trade history:', error.message);
        throw error;
    }
};
