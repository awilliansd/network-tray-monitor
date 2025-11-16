// config.js
module.exports = {
  IP_LIST: [
    "TETRAGRAMMATON",
    "CHRONOS",
    "PROMETHEUS",
    "HEPHAESTUS",
    "raspberrypi",
    "SABRLFNNSCJ3"
  ],
  // Adiciona verificação de internet
  INTERNET_CHECK: {
    enabled: true,
    host: "8.8.8.8", // Google DNS
    label: "🌐 Internet (Google DNS)"
  },
  PING_TIMEOUT: 1,
  UPDATE_INTERVAL: 120000 // 2 minutos
};