// Dependencies.
const ccxt = require('ccxt');
const atrCalculator = require('technicalindicators').ATR; 
require('dotenv').config()

// Exchanges
const binance = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY,
    secret: process.env.BINANCE_SECRET_KEY
});
const ftx = new ccxt.ftx({
    apiKey: process.env.FTX_API_KEY,
    secret: process.env.FTX_SECRET_KEY
});

const baseCurrency = 'ETH';
const quoteCurrency = 'USDT';
const symbol = baseCurrency + '/' + quoteCurrency;
const timeframe = '1d';
const since = undefined;
const limit = 31;
const period = 1;
const multiplier = 3;

// To print candleSticksData data in formatted form.
function consolePrinter(data) {

    const table = [];
    for(let i = 0; i<data.length; i++) {
        table.push ({
            'number': i+1,
            'timestamp': new Date(data.timestamp[i]*1000).toLocaleString("en-US"),
            'open': data.open[i],
            'high': data.high[i],
            'low': data.low[i],
            'close': data.close[i],
            'atr': data.atr[i],
            'upperBand': data.upperBand[i],
            'lowerBand': data.lowerBand[i],
            'inTrend': data.inTrend[i]
        });
    }
    return table;
}

// Checks whether to do a order or not.
async function executeOrder(data) {
    console.log("Check to execute an order or not!");

    let currentVal = data.length - 1;
    let previousVal = data.length - 2;
    
    if(data.inTrend[previousVal] === false && data.inTrend[currentVal] === true) {
        console.log('Buying....');
        buyBase();
    }

    if(data.inTrend[previousVal] === true && data.inTrend[currentVal] === false) {
        console.log('Selling...');
        sellBase();
    }
    
    if(data.inTrend[previousVal] === false && data.inTrend[currentVal] === false)
        console.log(`Let's wait for the uptrend to come.`);
    
    if(data.inTrend[previousVal] === true && data.inTrend[currentVal] === true)
        console.log(`Let's wait for the downtrend to come.`);
}

// Fetches balance in the account of given symbol.
async function balanceFetcher(symbol) {

    let balance = await ftx.fetchBalance();
    console.log(`Balance of the ${symbol} is ${balance.free[symbol]}`);
    return balance.free[symbol];
}

// Creates a buy order of baseCurrency.
async function buyBase() {

    let ticker = await ftx.fetchTicker(symbol);
    let balance = await balanceFetcher(quoteCurrency);
    let price = parseFloat(ticker.info.price);
    console.log(`${baseCurrency} price is ${price}`);
    
    let buyAmount = balance/price;
    console.log(`Buying ${buyAmount} of ${baseCurrency}`);

    // Creating order.
    let order = await ftx.createMarketOrder(symbol, "buy", buyAmount);
    console.log(order);
}

// Creates a sell order of baseCurrency.
async function sellBase() {
    
    let balance = await balanceFetcher(baseCurrency);
    console.log(`Selling ${balance} ${baseCurrency}s`);
    
    // Creating order.
    let order = await ftx.createMarketOrder(symbol, 'sell', balance);
    console.log(order);
}

async function main() {

        try {
            let ohlcvs = await binance.fetchOHLCV(symbol, timeframe, since, limit);
            ohlcvs.pop(); //Removing the last element because its not complete.
            
            if(ohlcvs.length > 0) {
                const candleSticksData = binance.convertOHLCVToTradingView(ohlcvs, 'timestamp', 'open', 'high', 'low', 'close', 'volume');

                candleSticksData.period = period;
                candleSticksData.length = ohlcvs.length;
                

                // Calculating ATR.
                candleSticksData.atr = atrCalculator.calculate(candleSticksData);
                for(var i = 0; i<candleSticksData.period; i++)
                    candleSticksData.atr.unshift(0);
    
                // Calculating upper and lower bands.
                candleSticksData.upperBand = [];
                candleSticksData.lowerBand = [];
                candleSticksData.inTrend = [true];
                for(let i = 0; i<candleSticksData.length; i++) {
                    candleSticksData.upperBand[i] = ((candleSticksData.high[i]+candleSticksData.low[i])/2 + (multiplier * candleSticksData.atr[i]));
                    candleSticksData.lowerBand[i] = ((candleSticksData.high[i]+candleSticksData.low[i])/2 - (multiplier * candleSticksData.atr[i]));
                    
                }

                // Calculating trends
                for(let i = 1; i<candleSticksData.length; i++) {

                    if(candleSticksData.close[i] > candleSticksData.upperBand[i-1])
                        candleSticksData.inTrend.push(true);
                    else if(candleSticksData.close[i] < candleSticksData.lowerBand[i-1])
                        candleSticksData.inTrend.push(false);
                    else {

                        candleSticksData.inTrend.push(candleSticksData.inTrend[i-1]);

                        if(candleSticksData.inTrend[i] === true && (candleSticksData.lowerBand[i] < candleSticksData.lowerBand[i-1]))
                            candleSticksData.lowerBand[i] = candleSticksData.lowerBand[i-1];
            
                        if(candleSticksData.inTrend[i] === false && (candleSticksData.upperBand[i] > candleSticksData.upperBand[i-1]))
                            candleSticksData.upperBand[i] = candleSticksData.upperBand[i-1];
                    }
                }
                console.table(consolePrinter(candleSticksData));
                executeOrder(candleSticksData);
            }
        }
        catch(e) {
            console.log("Error: " + e.message);
        }    
}

main();
