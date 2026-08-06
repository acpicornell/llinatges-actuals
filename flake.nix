{
  description = "Modern Mallorcan surname isonymy — full INE surname census (2025)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in
    {
      # `nix develop` -> Python (pandas/numpy/scipy) for the INE pipeline (src/).
      # The fetchers use only the standard library; build_modern.py / isonymy.py need
      # numpy + pandas + scipy. Pinned via flake.lock (shared rev with llinatges-medievals).
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            (pkgs.python3.withPackages (ps: with ps; [ pandas numpy scipy ]))
          ];
        };
      });
    };
}
