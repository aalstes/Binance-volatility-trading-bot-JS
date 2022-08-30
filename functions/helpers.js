const { readFile, writeFile } = require("fs").promises;
const Sentry = require("@sentry/node");

const returnPercentageOfX = (x, percentage) => {
  return (percentage * x) / 100;
};
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const removeDuplicates = (array) => {
  return [...new Set(array)];
};

const detectVolatiles = (initialPrices, latestPrices) => {
  const volatiles = [];
  for (const coin in initialPrices) {
    const changePercentage =
      ((latestPrices[coin]["price"] - initialPrices[coin]["price"]) /
        initialPrices[coin]["price"]) *
      100;
    if (changePercentage >= process.env.VOLATILE_TRIGGER) {
      const formatedChange = Number(changePercentage).toFixed(2);
      console.log(
        `${returnTimeLog()} The price of ${coin} has increased ${formatedChange}% to ${
          latestPrices[coin]["price"]
        }
        within last ${process.env.INTERVAL} minutes...`
      );
      volatiles.push(coin);
    }
  }
  return removeDuplicates(volatiles);
};

const returnTimeLog = () => `[${new Date().toLocaleString()}] `;

const readPortfolio = async () => {
  try {
    return JSON.parse(await readFile("holding-assets.json"));
  } catch (error) {
    Sentry.captureException(error);
    throw `Error reading portfolio: ${error}`;
  }
};

const savePortfolio = async (data) => {
  try {
    await writeFile("holding-assets.json", JSON.stringify(data, null, 4), {
      flag: "w",
    });
  } catch (error) {
    Sentry.captureException(error);
    throw `Error saving portfolio: ${error}`;
  }
};

const getBinanceConfig = async () => {
  try {
    return JSON.parse(await readFile("exchange-config.json"));
  } catch (error) {
    Sentry.captureException(error);
    throw `Error getting exchange config: ${error}`;
  }
};

const toCcxtSymbol = (symbol) => {
  const quoteCurrency = process.env.PAIR_WITH;
  return symbol.replace(quoteCurrency, `/${quoteCurrency}`);
};

function checkMinimumQuantity(exchange, market, totalAmount, originalRate) {
  const ccxtMarket = exchange.markets[market];

  if (!ccxtMarket) {
    return false;
  }

  const { amount, cost } = ccxtMarket.limits;
  const realAmount = exchange.amountToPrecision(market, totalAmount);
  const realOriginalRate = exchange.priceToPrecision(market, originalRate);
  const realCosts = realAmount * realOriginalRate;

  if (cost?.min && cost.min > 0 && realCosts < cost.min) {
    return false;
  }

  if (amount?.min && amount.min > 0 && realAmount < amount.min) {
    return false;
  }

  return true;
}

module.exports = {
  returnPercentageOfX,
  sleep,
  getBinanceConfig,
  detectVolatiles,
  returnTimeLog,
  readPortfolio,
  savePortfolio,
  toCcxtSymbol,
  checkMinimumQuantity,
};
