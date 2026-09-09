# Changelog

## [0.2.0](https://github.com/POlc4/sillygames/compare/v0.1.0...v0.2.0) (2026-09-09)


### Fonctionnalités

* **auth:** add external sign-in with GitHub, Google, Microsoft and Facebook ([45c8f70](https://github.com/POlc4/sillygames/commit/45c8f70bb7627f397984c1274050e6a7b139458f))
* **backend:** add game and stats routes ([c2da07b](https://github.com/POlc4/sillygames/commit/c2da07b735007bc60de082dc023632275ad7772a))
* **backend:** add persistence and guest/account authentication ([da61918](https://github.com/POlc4/sillygames/commit/da6191874725852be58db0e3d512489599479d4e))
* **backend:** add sticks and rock-paper-scissors engines with AI strategies ([e9df3cc](https://github.com/POlc4/sillygames/commit/e9df3cc05e17b95fb34cc99d5583ab1a774e219e))
* **backend:** import offline games with server-side replay validation ([8e16741](https://github.com/POlc4/sillygames/commit/8e167415f20e7439311b65651646a8aea8844d7f))
* **backend:** rate-limit the authentication routes per IP ([33706d9](https://github.com/POlc4/sillygames/commit/33706d913dc8008ccaae39aeee056a69479ac990))
* containerize the stack and add Playwright end-to-end tests ([7a52c65](https://github.com/POlc4/sillygames/commit/7a52c6585f3336e1b15fa822889381466e5e1501))
* **deploy:** add production stack, VM setup, deploy and backup workflows ([91a27c7](https://github.com/POlc4/sillygames/commit/91a27c7499f778f5f6f322776a2fe8ef1a611d30))
* **frontend:** add 3D scenes for sticks and rock-paper-scissors ([a09a6c5](https://github.com/POlc4/sillygames/commit/a09a6c57860f0b70755f6e5810e830372fc8f53b))
* **frontend:** add Next.js app with 2D game pages, session and stats ([678d4e9](https://github.com/POlc4/sillygames/commit/678d4e980f8bdf48b276d0b194066056ba4af089))
* **frontend:** make the site an installable PWA and port the engines to TypeScript ([7a65bc3](https://github.com/POlc4/sillygames/commit/7a65bc31a5c660741ff7c0ef438f7f6cf708d5c8))
* **frontend:** play offline with local engines and sync games on reconnect ([cf6a1d9](https://github.com/POlc4/sillygames/commit/cf6a1d9d640f5028b57ce8ace761cc3d867b181b))
* **ml:** add learning AI strategies, trainers and weekly retraining ([391283a](https://github.com/POlc4/sillygames/commit/391283a802cfc75f0af474c9b9d917ba6cdbeb5b))


### Corrections

* **ci:** pull base images from the Docker Hub mirror and add diagnostics ([4a2a306](https://github.com/POlc4/sillygames/commit/4a2a306002959187c4d1f3fbb929d1a7908af460))
* **ci:** satisfy hadolint 2.15 and generate route types before tsc ([be2616e](https://github.com/POlc4/sillygames/commit/be2616e0abfaa91317eb1af2d5dddc4573694e3a))
* **ci:** valid deploy workflow, CodeQL v4, npm-free frontend runtime image ([1d23f7a](https://github.com/POlc4/sillygames/commit/1d23f7a9cf7fe8fe3c1108dd17de91ea5534731f))
* **devcontainer:** correct the compose build context, bump the Node feature to v2 ([89bf476](https://github.com/POlc4/sillygames/commit/89bf4769a9fc3a988de3b52847365c0c272e3b33))
* **pwa:** reload only on user request, add the offline e2e scenario ([e09afec](https://github.com/POlc4/sillygames/commit/e09afec66cccffbb4f9bed77eac9614ebf23985a))
* **release:** stop bumping backend/pyproject.toml, uv.lock pins the project version ([#9](https://github.com/POlc4/sillygames/issues/9)) ([ed0a91f](https://github.com/POlc4/sillygames/commit/ed0a91f7831616ffddf70a11d0861377ff0b094b))


### Documentation

* add ADR 0005 (state derived from moves) and 0006 (mirror, deploy after CI), plan status ([5421505](https://github.com/POlc4/sillygames/commit/5421505cbfffbdffeed2c77dc5f7fdf92588e720))
* ADR 0008 (offline play validated by replay) and Render + Neon fallback blueprint ([0169374](https://github.com/POlc4/sillygames/commit/01693748c6ea1b356384d3544ca03706fcbe676c))
* main branch ruleset (no direct push, PR + review + CI) and branch-based workflow ([a073195](https://github.com/POlc4/sillygames/commit/a073195fd91167366b4549145930b9ea2be18280))
* **plan:** add external OAuth identities step and PWA phase ([d9b595b](https://github.com/POlc4/sillygames/commit/d9b595b0e52e510d08ddaa2dc61bad8eb4a6f46a))
* **plan:** add optional phase 4 with Rust service and WASM engines ([5a3cd42](https://github.com/POlc4/sillygames/commit/5a3cd42b30a286d860501100702c6486bd16250b))
* **runbook:** actionlint and Trivy local commands, reading CI state without login ([7748393](https://github.com/POlc4/sillygames/commit/77483936cae0d470d473f821f4b8772e7dffef16))


### CI/CD

* add security scanning, dependency updates, releases and repo governance ([1a4b510](https://github.com/POlc4/sillygames/commit/1a4b510f7f307070beae2ff9d83a137d1616b129))
* **deps:** accept Dependabot subjects and ignore majors that need manual planning ([c96c4fd](https://github.com/POlc4/sillygames/commit/c96c4fdfcf5d5d48849d179a04713ac3d6ba5751))
* finer build failure annotations (one per error line). ([91a27c7](https://github.com/POlc4/sillygames/commit/91a27c7499f778f5f6f322776a2fe8ef1a611d30))
