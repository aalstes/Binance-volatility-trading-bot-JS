const https = require("https");
const { ccxtBinance } = require("./binance");
require("./functions/getExchangeConfig");
const { handleBuy } = require("./functions/buy");
const { handleSell, handleLimitOrderSell } = require("./functions/sell");
const getPrices = require("./functions/getPrices");
const {
  sleep,
  detectVolatiles,
  returnTimeLog,
} = require("./functions/helpers");
const safeScan = require("./functions/scan");
const { SAFE_MODE, TRAILING_MODE } = require("./constants");

const app = https.createServer();

const { INTERVAL, SCAN_INTERVAL } = process.env;
const intervalInMs = INTERVAL * 60000;
const scanIntervalInMs = SCAN_INTERVAL * 60000;

let latestPrices;

const main = async () => {
  try {
    await ccxtBinance.loadMarkets();

    const initialPrices = await getPrices();
    while (
      initialPrices["BTCUSDT"].time >
      new Date().getTime() - intervalInMs
    ) {
      console.log(
        `${returnTimeLog()} Wait for the bot to gather data to check price volatility...`
      );
      await sleep(intervalInMs);
    }
    latestPrices = await getPrices();
    const volatiles = detectVolatiles(initialPrices, latestPrices);
    if (TRAILING_MODE) {
      await handleSell(latestPrices);
    }
    await handleBuy(volatiles);
  } catch (error) {
    console.log(
      `${returnTimeLog()} Error in excuting main function: ${
        error || JSON.stringify(error)
      }`
    );
  }
};

main();
setInterval(main, intervalInMs);

if (SAFE_MODE) {
  setInterval(safeScan, scanIntervalInMs);
}

if (!TRAILING_MODE) {
  setInterval(handleLimitOrderSell, 10000);
}

module.exports = app;
