# prerequisites

- An Auth0 tenant is required to operate this CLI.
  To create one, visit: https://auth0.com/signup.

# description

This utility will create and configure the CBS application for your Auth0 tenant. It will also create an admin user for the CBS application.

The repository also contains example docker-compose.yml files for deploying the CBS and a CDN.

# installation

```bash
git clone https://registry.gitlab.com/csir-meme/deploy.git .
npm ci
```

# provisioning the CBS application

```bash
node main
```

- If you have multiple tenants configured in Auth0, you will asked to select one. You will also be asked to confirm on the CLI that this is the correct tenant you want to deploy to.
- You need to enter the url where the CBS will be hosted at, with the default being http://cbs.test.localhost:8000.

# installing docker on your ubuntu host

[Source](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04)

```bash
sudo apt-get update
sudo apt install apt-transport-https ca-certificates curl software-properties-common
```

## add docker-ce ppa

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
```

## install docker

```bash
sudo apt install docker-ce
sudo systemctl status docker
```

## add user to docker group

```bash
sudo usermod -aG docker ${USER}
```

# configure remote machine

## ssh configuration

add to `.ssh/config`:

```ini
Host oracle
  HostName 132.226.131.43
  User ubuntu
  IdentityFile ~/.ssh/gitlab
```

## create docker context

```bash
docker context create oracle --docker "host=ssh://oracle"
```

## switch docker context

```bash
docker context use oracle
```

## initialise docker swarm

```bash
docker swarm init
```

# deploying the CBS

Docker swarm commands do not source the `.env` file by default, so you need to do it manually before deploying. On linux, you can create an alias that will do that for you every time you run a docker command

```bash
alias docker='env $([ -f .env ] && cat .env) docker'
```

In powershell on Windows, you can run the `load-env.ps1` script to source the environment variables in `.env`. You will have to re-run it every time you change `.env`

```
./load-env.ps1
```

```bash
docker stack deploy cbs -c docker-compose.yml --with-registry-auth
```

# updating

Updating is essentially the same as deploying ...

```bash
docker stack deploy cbs -c docker-compose.yml --with-registry-auth

```

# troubleshooting

If you get an error similar to the following

```bash
❯ docker stack deploy cbs --compose-file docker-compose.yml
failed to update config caddy-v20: Error response from daemon: rpc error: code = InvalidArgument desc = only updates to Labels are allowed
```

you need to bump the version on tha caddy config in `docker-compose.yml`
