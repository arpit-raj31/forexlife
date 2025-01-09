import mongoose from 'mongoose';


const tradeSchema = new mongoose.Schema({
    symbol: { type: String, },
    type: { type: String, enum: ['Buy', 'Sell'] },
    volume: { type: Number },
    openPrice: { type: Number },
    closePrice: { type: Number, required: false },
    openTime: { type: Date, default: Date.now },
    closeTime: { type: Date, required: false },
    pnl: { type: Number, required: false }, 
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
    accountBalance: { type: Number, }, 
}, {
    timestamps: true, 
});


const UserTrade = mongoose.model('UserTrade', tradeSchema);

export default UserTrade;