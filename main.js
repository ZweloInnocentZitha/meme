import input from "@inquirer/input";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { decode } from "jsonwebtoken";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import open from "open";

const scopes = [
  // client
  "create:clients",
  "read:clients",
  "read:client_keys",
  "update:clients",
  // connections
  "create:connections",
  "read:connections",
  "update:connections",
  // resources
  "create:resource_servers",
  "read:resource_servers",
  "update:resource_servers",
  // grants
  "create:client_grants",
  "read:client_grants",
  "update:client_grants",
  //actions
  "create:actions",
  "read:actions",
  "update:actions",
  //tenant
  "update:tenant_settings",
  // users
  "create:users",
  "read:users",
  "update:users",
];

const { device_code, user_code, verification_uri_complete, interval } =
  await fetch("https://auth0.auth0.com/oauth/device/code", {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify({
      client_id: "2iZo3Uczt5LFHacKdM0zzgUO2eG2uDjT",
      grant_type: "device_code",
      audience: "https://*.auth0.com/api/v2/",
      scope: scopes.join(" "),
    }),
  }).then((res) => res.json());

console.log(
  `Verify code ${chalk.bold(
    user_code
  )} in browser window to complete authentication.`
);

(await confirm({
  message: "Open the browser window to log in?",
})) || process.exit();

open(verification_uri_complete);

let access_token;
while (true) {
  const res = await fetch("https://auth0.auth0.com/oauth/token", {
    headers: { "Content-Type": "application/json" },
    method: "post",

    body: JSON.stringify({
      client_id: "2iZo3Uczt5LFHacKdM0zzgUO2eG2uDjT",
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
    }),
  });

  if (res.status === 200) {
    ({ access_token } = await res.json());
    break;
  }

  if (res.status === 403) {
    const { error, error_description } = await res.json();

    if (error == "authorization_pending") {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      continue;
    }

    throw new Error(error_description);
  }

  throw new Error(res.statusText);
}

const { aud } = decode(access_token, { json: true });
const domain = new URL(aud).host;
(await confirm({ message: `Provisioning CBS on ${domain}. Are you sure?` })) ||
  process.exit();

const cbsUrl = await input({
  message: "Enter the url that the CBS will be available on: ",
  default: "http://cbs.test.localhost:8000",
});

const CBS_DOMAIN = new URL(cbsUrl);
CBS_DOMAIN.host = ["*", ...CBS_DOMAIN.host.split(".").slice(1)].join(".");

const cli = spawn("npx", ["auth0-deploy-cli", "import", "-i", "cbs.yaml"], {
  env: {
    PATH: process.env.PATH,
    AUTH0_DOMAIN: domain,
    AUTH0_ACCESS_TOKEN: access_token,
    CBS_DOMAIN: CBS_DOMAIN.origin,
  },
  shell: true,
});
cli.stdout.on("data", (data) => console.log(data.toString()));
cli.stderr.on("data", (data) => console.error(data.toString()));

await new Promise((resolve, reject) => {
  cli.on("close", resolve);
  cli.on("error", reject);
});

function api(url, init) {
  return fetch(new URL(url, aud), {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${access_token}` },
  }).then((res) => res.json());
}

// Configure admin user for CBS

const admins = await api("users?q=app_metadata.admin:(cbs)");
if (admins.length > 0) {
  console.log(
    "admin user(s) already configured:",
    admins.map(({ email }) => email).join(" ")
  );
} else {
  const email = await input({
    message: "Enter the email of the admin user: ",
  });

  let [user] = await api(
    `users?q=identities.connection:(cbs) AND (email IN (${email}))`
  );
  if (user) {
    const adminRoles = new Set(user.app_metadata?.admin);
    adminRoles.add("cbs");
    user = await api(`users/${user.user_id}`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
      body: JSON.stringify({ app_metadata: { admin: Array.from(adminRoles) } }),
    });
  } else {
    user = await api("users", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        connection: "cbs",
        email,
        email_verified: true,
        password: crypto.randomUUID(),
        app_metadata: {
          admin: ["cbs"],
        },
      }),
    });
  }

  console.log({ user });
}

// Get CBS info for .env file

(await confirm({
  message: `Create .env needed for deploying CBS?`,
})) || process.exit();

const clients = await api("clients");
const cbs = clients.find(({ name }) => name === "cbs");

await writeFile(
  ".env",
  `DOMAIN=${domain}
CLIENT_ID=${cbs.client_id}
CLIENT_SECRET=${cbs.client_secret}
CBS=${cbsUrl}`
);
