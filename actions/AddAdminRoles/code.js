exports.onExecuteCredentialsExchange = async (event, api) => {
  api.accessToken.setCustomClaim("https://c-me", {
    roles: ["admin", "superadmin"],
  });
};
