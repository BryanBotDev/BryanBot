{
  mkShellNoCC,
  eslint_d,
  prettierd,
  nodejs-slim,
  pnpm,
}:
mkShellNoCC {
  name = "bryanbot";
  packages = [
    eslint_d
    prettierd
    nodejs-slim
    pnpm
  ];
}
