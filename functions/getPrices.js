const { FIATS } = require("../constants");
const { binance } = require("../binance");
const { returnTimeLog } = require("./helpers");
const Sentry = require("@sentry/node");

const getPrices = async () => {
  try {
    let data = await binance.prices();
    const output = {};
    for (const coin in data) {
      if (
        coin.includes(process.env.PAIR_WITH) &&
        !coin.includes(FIATS) &&
        !coin.match(/UP|DOWN/g)
      ) {
        output[coin] = {
          price: data[coin],
          time: new Date().getTime(),
        };
      }
    }
    return output;
  } catch (error) {
    console.log(
      `${returnTimeLog()} There was an error getting prices: ${
        error.body || JSON.stringify(error)
      }`
    );
    Sentry.captureException(error);
  }
};

module.exports = getPrices;
