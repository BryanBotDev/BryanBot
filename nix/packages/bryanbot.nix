{
  lib,
  stdenvNoCC,
  git,
  nodejs,
  pnpm_10,
  makeWrapper,
  nix-update-script,
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "BryanBot";
  version = "2.0.0";

  src = builtins.path {
    path = ../../.;
    name = "bryanbot-source";
  };

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-oSVQfkeG+Kw2YAOJSqOSySReozWe0/3jcB7uRZ8a7ng=";
  };

  nativeBuildInputs = [
    git
    nodejs
    pnpm_10.configHook
    makeWrapper
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp $src/src/index.js $out/bin/bryanbot
    chmod +x $out/bin/bryanbot
    wrapProgram $out/bin/bryanbot \
      --prefix PATH : ${lib.makeBinPath [nodejs]}

    runHook postInstall
  '';

  passthru.updateScript = nix-update-script {};

  meta = {
    description = "Modular, up-to-date Discord bot that just works";
    homepage = "https://github.com/BryanBotDev/BryanBot";
    platforms = lib.platforms.linux;
    mainProgram = "bryanbot";
    maintainers = [
      lib.maintainers.NotAShelf
    ];
  };
})
