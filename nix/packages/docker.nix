{
  self,
  dockerTools,
  buildEnv,
  nodejs,
  ...
}: let
  name = "node";
  tag = "current-alpine";
  digest = "sha256:b2f1e6d2f9eaf82afc910ec1e3b14f2a252be3f91e661602017974dee1bd9f40";

  # TODO: we can stick all of this into a "manifest" in JSON and update it with nix-prefetch-docker
  baseImage = dockerTools.pullImage {
    imageName = name;
    imageDigest = digest;
    finalImageName = name;
    finalImageTag = tag;
    sha256 = "sha256-nk6QCkQQe7Ms0ZJjDqEz9U7fXnydnaRJj5nam3hTGq4=";
  };
in
  dockerTools.buildImage {
    name = "brayanbot";
    tag = "latest";

    # Decent compression at the cost of some additional system resources. Since
    # this image will be built by GitHub's runners, the cost is negligible.
    compressor = "zstd";

    # First we pull the appropriate nodejs image. This is the equivalent of
    # 'FROM node:current-alpine as base'
    fromImage = baseImage;

    copyToRoot = buildEnv {
      name = "image-root";
      paths = [nodejs self];
      pathsToLink = ["/bin" "/src"];
    };

    config = {
      Cmd = ["node" "/src/index.js"];
      WorkingDir = "/data";
      Volumes = {
        "/data" = {};
      };

      ExposedPorts = {};
    };

    diskSize = 1024;
    buildVMMemorySize = 512;
  }
