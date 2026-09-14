install:
	cd frontend && cp .env.sample .env
	docker-compose run frontend npm i
	docker-compose run backend npm i
start:
	docker-compose up -d
stop:
	docker-compose down

PROD_COMPOSE = docker-compose -f compose.prod.yml -f compose.prod.override.yml
prod-install:
	cp compose.prod.override.yml.sample compose.prod.override.yml
	$(PROD_COMPOSE) build
prod-start:
	$(PROD_COMPOSE) up -d
prod-stop:
	$(PROD_COMPOSE) down
prod-update:
	$(PROD_COMPOSE) build --pull

.PHONY: *
