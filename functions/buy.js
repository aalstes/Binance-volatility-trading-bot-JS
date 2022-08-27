const Sentry = require("@sentry/node");
const { binance, ccxtBinance } = require("../binance");
const { MARKET_FLAG } = require("../constants");
const {
  returnPercentageOfX,
  returnTimeLog,
  readPortfolio,
  savePortfolio,
  getBinanceConfig,
  toCcxtSymbol,
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

const calculateBuyingQuantity = async (symbol, length, portfolio) => {
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

    const price = await binance.prices(symbol);
    const quantity = allowedAmountToSpend / price[symbol];
    const quantityBasedOnStepSize = await binance.roundStep(quantity, stepSize);
    return quantityBasedOnStepSize;
  } catch (error) {
    Sentry.captureException(error);
    throw `Error in calculating quantity: ${JSON.stringify(error)}`;
  }
};

const handleBuy = async (volatiles) => {
  if (volatiles.length) {
    for (const symbol of volatiles) {
      try {
        const portfolio = await readPortfolio();
        const quantity = await calculateBuyingQuantity(
          symbol,
          volatiles.length,
          portfolio
        );
        if (quantity === -1) {
          return;
        }
        const purchaseData = await buy(symbol, quantity);
        console.log("purchaseData", purchaseData);
        const { price } = purchaseData.fills[0];

        const orderData = {
          symbol,
          quantity,
          orderId: purchaseData.orderId,
          bought_at: Number(price),
          TP_Threshold:
            Number(price) + returnPercentageOfX(Number(price), TP_THRESHOLD),
          SL_Threshold:
            Number(price) - returnPercentageOfX(Number(price), SL_THRESHOLD),
          purchase_time: new Date().toLocaleString(),
          purchase_time_unix: new Date().getTime(),
          updated_at: new Date().toLocaleString(),
        };

        const ccxtSymbol = toCcxtSymbol(symbol);

        // From https://github.com/ccxt/ccxt/issues/14595
        const params = {
          symbol, // binance.market(symbol)['id'],
          side: "SELL",
          quantity: ccxtBinance.amountToPrecision(ccxtSymbol, quantity),
          price: ccxtBinance.priceToPrecision(
            ccxtSymbol,
            orderData.TP_Threshold
          ),
          stopPrice: ccxtBinance.priceToPrecision(
            ccxtSymbol,
            orderData.SL_Threshold * 1.001 // to ensure it executes
          ),
          stopLimitPrice: ccxtBinance.priceToPrecision(
            ccxtSymbol,
            orderData.SL_Threshold
          ),
          stopLimitTimeInForce: "GTC",
        };
        // it’s recommended that the stop price for sell orders should be slightly higher than the limit price
        // https://www.binance.com/en/support/faq/115003372072
        console.log("params", params);

        const oco_orders = await ccxtBinance.private_post_order_oco(params);
        const orders = oco_orders.orderReports.map((item) =>
          ccxtBinance.parseOrder(item)
        );
        const stopOrder = orders.find(
          (item) => item.info.type === "STOP_LOSS_LIMIT"
        );
        const limitOrder = orders.find(
          (item) => item.info.type === "LIMIT_MAKER"
        );

        console.log("limitOrder price", limitOrder.price);
        console.log("stopOrder price", stopOrder.price);
        console.log("stopOrder stop price", stopOrder.stopPrice);

        orderData.SL_Order = stopOrder.id;
        orderData.TP_Order = limitOrder.id;

        console.log("orderData", orderData);

        portfolio.push(orderData);
        console.log(
          `${returnTimeLog()} Successfully placed an order: ${JSON.stringify(
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
      `${returnTimeLog()} No coin has risen more than ${VOLATILE_TRIGGER}% in the last ${INTERVAL} minutes`
    );
  }
};

module.exports = { handleBuy };
