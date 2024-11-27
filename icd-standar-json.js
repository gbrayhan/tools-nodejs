const fs = require('fs');
const xlsx = require('xlsx');

// Ruta al archivo XLSX
const xlsxFilePath = 'docs/icd/SimpleTabulation-ICD-11-MMS-es.xlsx';

try {
    // Leer el archivo XLSX
    const workbook = xlsx.readFile(xlsxFilePath);

    // Obtener el nombre de la primera hoja de cálculo
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error(`La hoja "${sheetName}" no se encontró en el archivo XLSX.`);
    }

    // Convertir la hoja en un array de objetos JSON
    const records = xlsx.utils.sheet_to_json(worksheet);

    // Arrays y Mapas para almacenar categorías, capítulos y bloques
    const categoriesArray = [];
    const chaptersMap = new Map();
    const blocksMap = new Map();

    // Procesar cada registro
    records.forEach(row => {
        const classKind = row['ClassKind'] ? row['ClassKind'].toLowerCase() : '';
        const chapterNo = row['ChapterNo'] ? row['ChapterNo'].toString() : '';
        const blockId = row['BlockId'] ? row['BlockId'].toString() : '';

        if (classKind === 'chapter') {
            // Guardar información del capítulo en el mapa
            chaptersMap.set(chapterNo, {
                ChapterNo: chapterNo,
                ChapterTitleEN: row['TitleEN'] || 'Título Desconocido',
                ChapterTitle: row['Title'] || 'Título Desconocido'
            });
        } else if (classKind === 'block') {
            // Guardar información del bloque en el mapa
            blocksMap.set(blockId, {
                BlockId: blockId,
                BlockTitleEN: row['TitleEN'] || 'Título Desconocido',
                BlockTitle: row['Title'] || 'Título Desconocido',
                ChapterNo: chapterNo
            });
        } else if (classKind === 'category') {
            // Agregar categoría al array de categorías
            categoriesArray.push(row);
        }
    });

    // Transformar las categorías agregando información de capítulo y bloque
    const transformedCategories = categoriesArray.map(category => {
        const chapterNo = category['ChapterNo'] ? category['ChapterNo'].toString() : '';
        const blockId = category['Grouping1'] ? category['Grouping1'].toString() : (category['BlockId'] ? category['BlockId'].toString() : '');

        const chapter = chaptersMap.get(chapterNo) || {
            ChapterNo: chapterNo,
            ChapterTitleEN: 'Título Desconocido',
            ChapterTitle: 'Título Desconocido'
        };

        const block = blocksMap.get(blockId) || {
            BlockId: blockId,
            BlockTitleEN: 'Título Desconocido',
            BlockTitle: 'Título Desconocido',
            ChapterNo: chapterNo
        };

        return {
            ChapterNo: chapter.ChapterNo,
            ChapterTitleEN: chapter.ChapterTitleEN,
            ChapterTitle: chapter.ChapterTitle,
            BlockId: block.BlockId,
            BlockTitleEN: block.BlockTitleEN,
            BlockTitle: block.BlockTitle,
            Code: category['Code'] || '',
            TitleEN: category['TitleEN'] || '',
            Title: category['Title'] || '',
            ClassKind: category['ClassKind'] || '',
            DepthInKind: category['DepthInKind'] || '',
            IsResidual: category['IsResidual'] || '',
            BrowserLink: category['BrowserLink'] || '',
            isLeaf: category['isLeaf'] || '',
            PrimaryTabulation: category['Primary tabulation'] || '',
            Grouping: {
                Grouping1: category['Grouping1'] || '',
                Grouping2: category['Grouping2'] || '',
                Grouping3: category['Grouping3'] || '',
                Grouping4: category['Grouping4'] || '',
                Grouping5: category['Grouping5'] || ''
            },
            Version: category['Version:2024 Jan 21 - 22:30 UTC'] || ''
        };
    });

    // Opcional: Filtrar solo categorías válidas (si es necesario)
    const validCategories = transformedCategories.filter(cat => cat.Code && cat.Title);

    // Escribir el array de categorías a un archivo JSON
    fs.writeFileSync('docs/icd/categoriesICDArray.json', JSON.stringify(validCategories, null, 2), 'utf8');
    console.log('Array de categorías guardado en categoriesICDArray.json');
} catch (err) {
    console.error(`Error al procesar el XLSX: ${err.message}`);
}
