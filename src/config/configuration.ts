export default () => ({
  port: parseInt(process.env.PORT || "3002", 10),
  callbackUrl: process.env.CALLBACK_URL,
});
