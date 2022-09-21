const Sentry = require("@sentry/node");
const { binance, ccxtBinance } = require("../binance");
const { MARKET_FLAG, TRAILING_MODE, BUY_DIPS_MODE } = require("../constants");
const {
  returnPercentageOfX,
  returnTimeLog,
  readPortfolio,
  savePortfolio,
  getBinanceConfig,
  toCcxtSymbol,
  checkMinimumQuantity,
} = require("./helpers");

const {
  VOLATILE_TRIGGER,
  INTERVAL,
  QUANTITY,
  MIN_QUANTITY,
  TP_THRESHOLD,
  SL_THRESHOLD,
} = process.env;

const calculatePortfolioValue = (portfolio) => {
  let value = 0;
  if (portfolio.length) {
    portfolio.forEach(({ quantity, bought_at }) => {
      value += quantity * bought_at;
    });
  }
  return value;
};

const buy = async (coin, quantity) => {
  try {
    const orderData = await binance.marketBuy(
      coin,
      quantity,
      (flags = MARKET_FLAG)
    );
    return orderData;
  } catch (error) {
    Sentry.captureException(error);
    throw `Error in executing buy function: ${
      error.body || JSON.stringify(error)
    }`;
  }
};

const calculateBuyingQuantity = async (symbol, length, portfolio, price) => {
  try {
    const exchangeConfig = await getBinanceConfig();
    const { stepSize } = exchangeConfig[symbol];
    const currentPortfolioValue = calculatePortfolioValue(portfolio);

    // The budget is splited equally for each order
    let allowedAmountToSpend = QUANTITY / length;

    /* Generally the bot will not spend 100% (only like 98-99%) of the budget because the the actual quantity is rounded down
     Do not buy if current portolio value is greater than 90% of the orignal quantity */
    if (currentPortfolioValue >= returnPercentageOfX(QUANTITY, 90)) {
      console.log(
        "Current portfolio value exceeds the initial quantity, waiting for the current asset(s) to be sold first..."
      );
      return -1;
    }

    /* 
      In case the allowed amount smaller than the min qty, proceed to buy the with the min qty
      For example in an interval, there are 4 coins to buy and the budget is 30...
      since you can't buy with 30/4 = 7.5 USDT, the allowed amount is increased to 11
      In this case, only the first two coins in this batch will be bought at 11 USDT each, 8 USDT won't be spent
    */
    if (allowedAmountToSpend < MIN_QUANTITY) {
      allowedAmountToSpend = MIN_QUANTITY;
    }

    const quantity = allowedAmountToSpend / price;
    const quantityBasedOnStepSize = await binance.roundStep(quantity, stepSize);
    return quantityBasedOnStepSize;
  } catch (error) {
    Sentry.captureException(error);
    throw `Error in calculating quantity: ${JSON.stringify(error)}`;
  }
};

async function placeLimitOrder(market, type, amount, price, trailingdDelta) {
  const roundedPrice = ccxtBinance.costToPrecision(market, price);
  const roundedAmount = ccxtBinance.amountToPrecision(market, amount);
  const params = {};
  if (trailingdDelta) {
    // TODO: use this with stop loss order
    params.trailingdDelta = trailingdDelta;
  }

  return ccxtBinance
    .createOrder(market, "LIMIT", type, roundedAmount, roundedPrice, params)
    .catch((error) => {
      console.log(`Error when placing ${type} order on ${market}`);
      Sentry.captureException(error);
    });
}

const handleBuy = async (volatiles, latestPrices) => {
  if (volatiles.length) {
    for (const symbol of volatiles) {
      try {
        const ccxtSymbol = toCcxtSymbol(symbol);

        // Check if last 1m candle is green.
        const OHLCV = await ccxtBinance.fetchOHLCV(
          ccxtSymbol,
          "1m",
          undefined,
          3
        );
        const lastOpen = OHLCV[0][1];
        const lastClose = OHLCV[0][4];
        const lastCandleIsGreen = lastClose > lastOpen;
        console.log(
          `${ccxtSymbol} last open is ${lastOpen} and last close is ${lastClose}.`
        );

        if (lastCandleIsGreen) {
          console.log("Last candle is green. Proceeding to buy.");
        } else {
          console.log("Last candle is not green. Skipping.");
          continue;
        }

        const latestPrice = latestPrices[symbol]["price"];
        const portfolio = await readPortfolio();
        const quantity = await calculateBuyingQuantity(
          symbol,
          volatiles.length,
          portfolio,
          latestPrice
        );
        if (quantity === -1) {
          return;
        }

        const SL_price =
          latestPrice - returnPercentageOfX(latestPrice, SL_THRESHOLD);

        // Check that SL order qty/cost is not too small.
        if (
          !checkMinimumQuantity(ccxtBinance, ccxtSymbol, quantity, SL_price)
        ) {
          console.log(
            `SL order qty/cost is too small on ${ccxtSymbol}. Qty: ${quantity}, SL_price: ${SL_price} `
          );
          continue;
        }

        const purchaseData = await buy(symbol, quantity);
        const { price } = purchaseData.fills[0];

        const orderData = {
          symbol,
          quantity,
          orderId: purchaseData.orderId,
          bought_at: Number(price),
          TP_Threshold:
            Number(price) + returnPercentageOfX(Number(price), TP_THRESHOLD),
          SL_Threshold: SL_price,
          purchase_time: new Date().toLocaleString(),
          purchase_time_unix: new Date().getTime(),
          updated_at: new Date().toLocaleString(),
        };

        if (!BUY_DIPS_MODE) {
          const sl_order = await placeLimitOrder(
            ccxtSymbol,
            "sell",
            quantity,
            SL_price,
            TRAILING_MODE ? Number(SL_THRESHOLD) * 100 : undefined
          );

          orderData.SL_Order = sl_order.id;
        } else {
          const TP_price =
            Number(latestPrice) +
            returnPercentageOfX(Number(latestPrice), TP_THRESHOLD);
          const tp_order = await placeLimitOrder(
            ccxtSymbol,
            "sell",
            quantity,
            TP_price
          );

          orderData.SL_Order = tp_order.id;
        }

        console.log("orderData", orderData);

        portfolio.push(orderData);
        console.log(
          `${returnTimeLog()} Successfully placed buy and limit sell orders: ${JSON.stringify(
            orderData
          )}`
        );
        await savePortfolio(portfolio);
      } catch (error) {
        console.log(
          `${returnTimeLog()} Error in executing buying volatiles function: ${
            error.body || JSON.stringify(error)
          }`
        );
        Sentry.captureException(error);
      }
    }
  } else {
    console.log(
      `${returnTimeLog()} No coin has changed more than ${VOLATILE_TRIGGER}% in the last ${INTERVAL} minutes`
    );
  }
};

module.exports = { handleBuy };
