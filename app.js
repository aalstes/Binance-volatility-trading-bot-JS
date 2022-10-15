const Sentry = require("@sentry/node");
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
const { SAFE_MODE, TRAILING_MODE, BUY_DIPS_MODE } = require("./constants");

const app = https.createServer();

const { INTERVAL, SCAN_INTERVAL, SENTRY_DSN } = process.env;
const intervalInMs = INTERVAL * 60000;
const scanIntervalInMs = SCAN_INTERVAL * 60000;

let latestPrices;

Sentry.init({
  dsn: SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

const main = async () => {
  try {
    await ccxtBinance.loadMarkets();

    const initialPrices = await getPrices();
    const quoteCurrency = process.env.PAIR_WITH;
    while (
      initialPrices[`BTC${quoteCurrency}`].time >
      new Date().getTime() - intervalInMs
    ) {
      console.log(
        `${returnTimeLog()} Wait for the bot to gather data to check price volatility...`
      );
      await sleep(intervalInMs);
    }
    latestPrices = await getPrices();
    const volatiles = detectVolatiles(initialPrices, latestPrices);
    await handleBuy(volatiles, latestPrices);
  } catch (error) {
    console.log(
      `${returnTimeLog()} Error in excuting main function: ${
        error || JSON.stringify(error)
      }`
    );
    Sentry.captureException(error);
  }
};

main();
setInterval(main, intervalInMs);

if (SAFE_MODE && !BUY_DIPS_MODE) {
  setInterval(safeScan, scanIntervalInMs);
}

setInterval(handleLimitOrderSell, 10000);

module.exports = app;
