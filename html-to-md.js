const fs = require('fs');
const path = require('path');
const TurndownService = require('turndown');

// Crear una instancia de TurndownService con estilo de bloque de código con vallas
const turndownService = new TurndownService({
    codeBlockStyle: 'fenced'
});

// Añadir una regla personalizada para manejar bloques de código
turndownService.addRule('codeBlock', {
    filter: (node) => node.nodeName === 'CODE' && node.parentNode.nodeName === 'DIV',
    replacement: (content, node) => {
        const language = node.className.match(/language-(\w+)/)?.[1] || '';
        return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
    }
});

// Función para leer y convertir archivos HTML en una carpeta a Markdown
function convertHtmlFilesInFolder(folderPath) {
    // Leer todos los archivos en la carpeta
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            return console.error('Failed to read directory:', err);
        }

        files.forEach(file => {
            let fullPath = path.join(folderPath, file);
            // Asegurarse de que solo se procesen archivos .html
            if (path.extname(file).toLowerCase() === '.html') {
                fs.readFile(fullPath, 'utf8', (err, html) => {
                    if (err) {
                        console.error(`Error reading the file ${file}:`, err);
                        return;
                    }

                    // Eliminar todo después de "Get started with ChatGPT"
                    const cutoffIndex = html.indexOf("Get started with ChatGPT");
                    if (cutoffIndex !== -1) {
                        html = html.substring(0, cutoffIndex);
                    }

                    // Convertir HTML a Markdown
                    const markdown = turndownService.turndown(html);
                    console.log(`Markdown for ${file}:\n${markdown}`);

                    // Opcional: Guardar el resultado en un archivo Markdown
                    fs.writeFile(fullPath.replace('.html', '.md'), markdown, (err) => {
                        if (err) {
                            console.error(`Error writing the markdown file for ${file}:`, err);
                        } else {
                            console.log(`Markdown file saved for ${file}.`);
                        }
                    });
                });
            }
        });
    });
}

// Cambia 'path/to/your/folder' al path de tu carpeta con archivos HTML
convertHtmlFilesInFolder('docs/html-to-md');
