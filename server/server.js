import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import connectDB from './src/config/database.js';
import routes from './src/routes/index.js';


dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

connectDB();

app.use('/', routes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));