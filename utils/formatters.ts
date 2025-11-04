function formatPhonephoneNumber(phoneNumber: string) {
  // Remove caracteres não numéricos
  phoneNumber = phoneNumber.replace(/\D/g, "");

  // Adiciona o sufixo do WhatsApp se não tiver
  if (!phoneNumber.endsWith("@s.whatsapp.net")) {
    phoneNumber += "@s.whatsapp.net";
  }

  return phoneNumber;
}

module.exports = {
  formatPhonephoneNumber,
};
