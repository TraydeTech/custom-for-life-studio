/**
 * PIX static payload generator for CPF/CNPJ/Email/Phone keys
 * Based on EMV Co specifications
 */

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value;
}

export function generatePixPayload(key: string, name: string, city: string, amount: number, transactionId: string = '***'): string {
  // Merchant Account Information
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', key.replace(/[.\-/]/g, ''));
  const merchantAccountInfo = formatField('26', gui + keyField);

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += merchantAccountInfo;
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986'); // Transaction Currency (BRL)
  payload += formatField('54', amount.toFixed(2)); // Transaction Amount
  payload += formatField('58', 'BR'); // Country Code
  payload += formatField('59', name.slice(0, 25)); // Merchant Name
  payload += formatField('60', city.slice(0, 15)); // Merchant City
  payload += formatField('62', formatField('05', transactionId.slice(0, 25))); // Additional Data Field (Transaction ID)

  payload += '6304'; // CRC16 indicator
  payload += crc16(payload);

  return payload;
}
