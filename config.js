module.exports = {
  IP_LIST: [
    "Chronos",
    "Helix",
    "Raspberrypi",
    "Sabrlfnnscj3",
    "Tetragrammaton",
  ],
  INTERNET_CHECK: {
    enabled: true,
    host: "8.8.8.8",
    label: "🌐 Internet (Google DNS)"
  },
  SERVICE_CHECKS: [
    { host: "api.ferdium.org", label: "💬 Ferdium API" }
  ],
  PING_TIMEOUT: 1,
  UPDATE_INTERVAL: 120000
};
