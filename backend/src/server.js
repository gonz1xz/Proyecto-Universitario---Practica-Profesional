import app from './app.js';
import dotenv from 'dotenv';
import { startPriceNotifications } from './services/priceNotifications.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  startPriceNotifications();
  console.log(`Server is running on port www.localhost:${PORT}`);
});
