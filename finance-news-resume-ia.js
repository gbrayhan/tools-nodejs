const axios = require('axios');
const OpenAI = require("openai");
require('dotenv').config()


const openai = new OpenAI();



// Configuración de las API Keys
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Función para obtener noticias y su sentimiento desde Alpha Vantage
async function fetchNews() {
    try {
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'NEWS_SENTIMENT',
                tickers: 'AAPL',
                apikey: ALPHA_VANTAGE_API_KEY
            }
        });

        // Extraemos la noticia con mayor relevancia
        const news = response.data.feed.sort((a, b) => parseFloat(b.ticker_sentiment[0].relevance_score) - parseFloat(a.ticker_sentiment[0].relevance_score))[0];

        return news;
    } catch (error) {
        console.error('Error fetching news:', error);
        return null;
    }
}

// Función para pedir a ChatGPT que lea y resuma una noticia
async function summarizeNews(newsUrl) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "You are a helpful assistant."
            },{
                role: "user",
                content: `Lee esta noticia y haz un resumen en español: ${newsUrl}`
            }]
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error creating chat completion:', error);
        return null;
    }
}

// Ejecutar el flujo principal
async function main() {
    const news = await fetchNews();
    if (!news) {
        console.log('No se pudo obtener noticias.');
        return;
    }

    const summary = await summarizeNews(news.url);
    console.log('Resumen:', summary);
}

main();
