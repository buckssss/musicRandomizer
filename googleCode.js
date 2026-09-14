function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  // Пропускаем строку заголовков (i=1)
  for (var i = 1; i < data.length; i++) {
    if (data[i] && data[i][0].toString().trim() !== "") {
      result.push({
        row: i + 1, // Запоминаем физический номер строки для будущего редактирования
        name: data[i][0].toString().trim(),
        isListened: data[i][1] ? data[i][1].toString().trim() : "",
        rating: data[i][2] ? data[i][2].toString().trim() : "",
        memo: data[i][3] ? data[i][3].toString().trim() : "",
        service: data[i][7] ? data[i][7].toString().trim() : ""
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var params = JSON.parse(e.postData.contents);
  
  // 1. Добавление нового альбома
  if (params.action === 'add') {
    sheet.appendRow([params.name, 'Нет', '', '']);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 2. Старт прослушивания (Кнопка "Слушаю сейчас")
  if (params.action === 'start_listening') {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === params.name.trim()) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, 2).setValue('listening'); // Столбец B
        sheet.getRange(rowNum, 8).setValue(params.service);   // Столбец H (какой сервис)
        if (params.memo) {
          sheet.getRange(rowNum, 4).setValue(params.memo);    // Столбец D (заметка)
        }
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  }

  // 3: Обновление статуса (Прослушано / Оценка)
  if (params.action === 'update') {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === params.name.trim()) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, 2).setValue('true'); // Колонка B
        sheet.getRange(rowNum, 3).setValue(params.rating); // Колонка C
        sheet.getRange(rowNum, 4).setValue(params.memo); // Колонка D
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  }
}