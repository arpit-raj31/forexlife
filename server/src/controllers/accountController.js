import DemoAccount from '../models/User.DemoAccount.js';
import DemoTransaction from '../models/User.DemoTransaction.js';
import LiveAccount from '../models/User.LiveAccount.model.js';
import LiveTransaction from '../models/User.LiveAccTransactions.js';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
import ShortUniqueId from 'short-uuid';
// Live Account 
const translator = ShortUniqueId();

const generateCustomUuid = async () => {
  let uniqueUuid;
  let isUnique = false;

  while (!isUnique) {
    // Generate a 6-digit number prefixed with 'BG'
    const uniquePart = Math.floor(100000 + Math.random() * 900000);
    uniqueUuid = `BG${uniquePart}`;

    // Check if the UUID exists in the database
    const existingAccount = await LiveAccount.findOne({ liveAccountUniqueId: uniqueUuid });

    if (!existingAccount) {
      isUnique = true; // UUID is unique
    }
  }

  return uniqueUuid;
};

export const createLiveAccount = async (req, res) => {
  const {
    userId,
    walletPin,
    leverage,
    currency,
    accountNickname,
    customLeverage,
    accountType,
  } = req.body;

  // Validate required fields
  if (!userId || !walletPin || !currency || !accountNickname || !accountType) {
    return res.status(400).json({ message: 'User ID, wallet PIN, currency, account nickname, and account type are required.' });
  }

  if (!leverage && !customLeverage) {
    return res.status(400).json({ message: 'Either leverage or custom leverage must be provided.' });
  }

  if (walletPin.length !== 4) {
    return res.status(400).json({ message: 'Wallet PIN must be exactly 4 digits long.' });
  }

  if (customLeverage && !/^1:\d+$/.test(customLeverage)) {
    return res.status(400).json({ message: 'Custom leverage must be in the format "1:number".' });
  }

  try {
    // Check if the user already has a live account
    const existingAccount = await LiveAccount.findOne({ user: userId });
    if (existingAccount) {
      return res.status(400).json({ message: 'Live account already exists for this user.' });
    }

    // Generate a custom unique ID
    const liveAccountUniqueId = await generateCustomUuid();

    // Create a new live account
    const newLiveAccount = new LiveAccount({
      user: userId,
      liveAccountUniqueId,
      walletPin,
      leverage,
      currency,
      accountNickname,
      customLeverage,
      accountType,
      balance: 0,
    });

    await newLiveAccount.save();

    // Update the user's liveAccount field
    await User.findByIdAndUpdate(userId, { liveAccount: newLiveAccount._id });

    // Fetch the user's email
    const user = await User.findById(userId);
    const userEmail = user.email;

    // Send the unique ID via email
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Or use any other email service
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to: userEmail, // Receiver address
      subject: 'Your Live Account Created Successfully', // Subject
      text: `Hello, your live account has been created successfully. Your unique Live Account ID is: ${liveAccountUniqueId}.`, // Email body
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: 'Live account created successfully. The unique account ID has been sent to your email.',
      liveAccount: newLiveAccount,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error creating live account.',
      error: err.message,
    });
  }
};


export const getLiveAccount = async (req, res) => {
  const { userId, uniqueUuid, walletPin } = req.params;

  try {
    // Find the live account that matches the userId, uniqueUuid, and walletPin
    const account = await LiveAccount.findOne({ 
      user: userId,
      liveAccountUniqueId: uniqueUuid,
      walletPin: walletPin,  // Ensure walletPin matches as well
    }).populate('user', 'username email');  // Populate user details

    // If no account is found, return an error
    if (!account) {
      return res.status(404).json({ message: 'Live account not found with the provided details.' });
    }

    // If account is found, return the account details
    res.status(200).json({ account });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching live account', error: err.message });
  }
};


export const updateBalance = async (req, res) => {
  const { userId } = req.params;
  const { balance } = req.body;

  try {
    const account = await LiveAccount.findOne({ user: userId });
    if (!account) {
      return res.status(404).json({ message: 'Live account not found' });
    }

    account.balance = balance;
    await account.save();

    res.status(200).json({ message: 'Balance updated successfully', account });
  } catch (err) {
    res.status(500).json({ message: 'Error updating balance', error: err.message });
  }
};


export const withdraw = async (req, res) => {
  const { userId } = req.params;
  const { amount, walletPin } = req.body;

  try {

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    const liveAccount = await LiveAccount.findOne({ user: userId });
    if (!liveAccount) {
      return res.status(404).json({ message: 'Live account not found' });
    }

    if (liveAccount.walletPin !== walletPin) {
      return res.status(401).json({ message: 'Invalid wallet pin' });
    }

    if (liveAccount.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    liveAccount.balance -= amount;

    const newTransaction = await LiveTransaction.create({
      user: userId,
      type: 'withdrawal',
      amount,
      status: 'atm', // Default status
      description: 'Withdraw to Live account',
    });

    liveAccount.transactions.push(newTransaction._id);

    await liveAccount.save();

    res.status(200).json({ message: 'Withdrawal successful', balance: liveAccount.balance });
  } catch (err) {
    console.error('Error during withdrawal:', err.message);
    res.status(500).json({ message: 'Error processing withdrawal', error: err.message });
  }
};


export const deposit = async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

    const liveAccount = await LiveAccount.findOne({ user: userId });
    if (!liveAccount) {
      return res.status(404).json({ message: 'Live account not found' });
    }

    liveAccount.balance += amount;


    const newTransaction = await LiveTransaction.create({
      user: userId,
      type: 'deposit',
      amount,
      status: 'atm', // Default status
      description: 'Deposit to Live account',
    });

    liveAccount.transactions.push(newTransaction._id);

    await liveAccount.save();

    res.status(200).json({ message: 'Deposit successful', balance: liveAccount.balance });
  } catch (err) {
    console.error('Error during deposit:', err.message);
    res.status(500).json({ message: 'Error processing deposit', error: err.message });
  }
};
export const innerLogin = async (req, res) => {
  const { liveAccountUniqueId, walletPin } = req.body;

  if (!liveAccountUniqueId || !walletPin) {
    return res.status(400).json({ message: 'UUID and Wallet Pin are required' });
  }

  try {
    // Find live account by the provided UUID
    const liveAccount = await LiveAccount.findOne({ liveAccountUniqueId });

    if (!liveAccount) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Check if wallet pin matches
    // You can either store walletPin as plain text or hashed using bcrypt
    if (liveAccount.walletPin !== walletPin) {
      return res.status(401).json({ message: 'Invalid Wallet Pin' });
    }

    // If login is successful, send back user info or a token
    return res.status(200).json({ message: 'Login successful', user: liveAccount });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Demo Account 


export const createDemoAccount = async (req, res) => {
  const { userId, leverage, currency, accountNickname, customLeverage, balance, accountType } = req.body;

  if (!userId || !currency || !accountNickname || !balance || !accountType) {
    return res.status(400).json({ message: 'User ID, currency, and account nickname balance accountType are required.' });
  }

  try {
    const existingAccount = await DemoAccount.findOne({ user: userId });
    if (existingAccount) {
      return res.status(400).json({ message: 'Demo account already exists for this user' });
    }

    const newDemoAccount = new DemoAccount({
      user: userId,
      balance,
      leverage,
      currency,
      accountNickname,
      customLeverage,
      accountType,
    });

    await newDemoAccount.save();

    // Update the user's demoAccount field
    await User.findByIdAndUpdate(userId, { demoAccount: newDemoAccount._id });

    res.status(201).json({
      message: 'Demo account created successfully',
      demoAccount: newDemoAccount,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error creating demo account',
      error: err.message,
    });
  }
};




export const getDemoAccount = async (req, res) => {
  const { userId } = req.params;

  try {
    const account = await DemoAccount.findOne({ user: userId }).populate('user', 'username email');
    if (!account) {
      return res.status(404).json({ message: 'Live account not found' });
    }

    res.status(200).json({ account });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching live account', error: err.message });
  }
};


export const updateDemoBalance = async (req, res) => {
  const { userId } = req.params;
  const { balance } = req.body;

  try {
    const account = await DemoAccount.findOne({ user: userId });
    if (!account) {
      return res.status(404).json({ message: 'Live account not found' });
    }

    account.balance = balance;
    await account.save();

    res.status(200).json({ message: 'Balance updated successfully', account });
  } catch (err) {
    res.status(500).json({ message: 'Error updating balance', error: err.message });
  }
};


export const demowithdraw = async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  try {

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    const demoAccount = await DemoAccount.findOne({ user: userId });
    if (!demoAccount) {
      return res.status(404).json({ message: 'Live account not found' });
    }


    if (demoAccount.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    demoAccount.balance -= amount;

    const newTransaction = await DemoTransaction.create({
      user: userId,
      type: 'withdrawal',
      amount,
      status: 'atm', // Default status
      description: 'Withdraw to demo account',
    });

    demoAccount.transactions.push(newTransaction._id);

    await demoAccount.save();

    res.status(200).json({ message: 'Withdrawal successful', balance: demoAccount.balance });
  } catch (err) {
    console.error('Error during withdrawal:', err.message);
    res.status(500).json({ message: 'Error processing withdrawal', error: err.message });
  }
};



export const demodeposit = async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

    // Find the user's demo account
    const demoAccount = await DemoAccount.findOne({ user: userId });
    if (!demoAccount) {
      return res.status(404).json({ message: 'Demo account not found' });
    }

    // Update the balance
    demoAccount.balance += amount;

    // Create a transaction record
    const newTransaction = await DemoTransaction.create({
      user: userId,
      type: 'deposit',
      amount,
      status: 'atm', // Default status
      description: 'Deposit to demo account',
    });

    // Add the transaction reference to the demo account
    demoAccount.transactions.push(newTransaction._id);

    // Save the updated demo account
    await demoAccount.save();

    res.status(200).json({
      message: 'Deposit successful',
      balance: demoAccount.balance,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error('Error during deposit:', error.message);
    res.status(500).json({ message: 'Error processing deposit', error: error.message });
  }
};



