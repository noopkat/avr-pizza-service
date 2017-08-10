![status not ready](https://img.shields.io/badge/status-somewhat%20alpha-yellow.svg) ![powered by Azure](https://img.shields.io/badge/powered%20by-Azure%20%E2%98%81%EF%B8%8F-blue.svg)

# avr-pizza-service

supply tarball, make pizza

This is the back-end cloud service of [avr-pizza](https://github.com/noopkat/avr-pizza). You probably just want to use [avr-pizza](https://github.com/noopkat/avr-pizza) instead. Nothing to see here.

:pizza: :pizza: :pizza:

## Build and Run

### Build Docker image
Build and host your own docker image.  You can host at [Docker Hub](https://hub.docker.com/) or [Azure Container Registry](https://docs.microsoft.com/en-us/azure/container-instances/container-instances-tutorial-prepare-acr). 

- `docker build -t avrpizza-service .`
- `docker tag avrpizza-service <yourregistry>/avrpizza-service`
- `docker push` (may need to login via `docker login`)

## Run in Azure
You can build it your self ([above](#build-docker-image)) and replace your registry name with your registry info below.  Or you can skip building your own version and use the image hosted at (coming soon...). 

- `az login` (follow prompt)
- `az resource create --name avrpizza-service-rg --location <eastus>`
- `az container create --name avrpizza-service --image <yourregistry>/avrpizza-service --cpu 1 --memory 1 --ip-address public -g avrpizza-service-rg`

The output will give you an public ip address you can see your service running at.

note: instructions on how to secure coming soon.