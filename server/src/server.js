require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 CWC Inventory Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
