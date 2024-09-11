const http = require('http');

// Configura la URL y los headers de la petición
const options = {
    hostname: 'localhost',
    port: 1234,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

// Define el body de la petición
const data = JSON.stringify({
    messages: [
        { role: "system", content: "You are a helpful coding assistant." },
        { role: "user", content: "How do I init and update a git submodule?" }
    ],
    temperature: 0.7,
    max_tokens: -1,
    stream: true
});

// Variable para almacenar las partes completas del mensaje
let completeMessage = '';

const req = http.request(options, (res) => {
    res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        // Elimina el primer 'data: ' solo si está al principio del string
        const jsonStr = chunkStr.replace(/^data: /, '');

        if (chunkStr === "data: [DONE]") {
            return
        }
        try {
            const parsedData = JSON.parse(jsonStr);
            if (parsedData.choices && parsedData.choices.length > 0) {
                const { content } = parsedData.choices[0].delta;
                if (content) {
                    completeMessage += content;
                }
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });

    res.on('end', () => {
        // Se ejecuta cuando la transmisión del mensaje ha terminado
        console.log('Complete message:', completeMessage);
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

// Envía la petición con el cuerpo del mensaje
req.write(data);
req.end();
