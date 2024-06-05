exports.onExecutePostLogin = async (event, api) => {
  if (event.authorization) {
    const roles = event.user.app_metadata.admin?.includes(event.client.name)
      ? ["admin"]
      : [];
    if (event.client.name == "cbs" && roles.length > 0) {
      // The CBS admin is also superadmin
      roles.unshift("superadmin");
    }

    const namespace = "https://c-me";
    api.accessToken.setCustomClaim(namespace, {
      roles,
      user: event.user.nickname,
    });
  }
};
