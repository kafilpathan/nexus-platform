"""
Toy Variational Autoencoder experiment for NEXUS KAF-AI.

Trains only on synthetic 2D points generated in this script. It does not load
NEXUS user data, change production models, or connect to the live platform.

Run from the repository root:
  python -m pip install -r research/requirements.txt
  python research/vae_toy.py --epochs 40 --samples 500 --output /tmp/nexus-vae-samples.csv
"""
import argparse
import csv
import math
import random

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


def make_synthetic_data(count: int, seed: int) -> torch.Tensor:
    generator = torch.Generator().manual_seed(seed)
    centers = torch.tensor([[-2.0, -1.0], [1.8, -1.5], [0.0, 2.0]])
    labels = torch.randint(0, len(centers), (count,), generator=generator)
    noise = torch.randn(count, 2, generator=generator) * 0.35
    return centers[labels] + noise


class VAE(nn.Module):
    def __init__(self, latent_dim: int = 2):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(2, 32), nn.ReLU(), nn.Linear(32, 16), nn.ReLU())
        self.mean = nn.Linear(16, latent_dim)
        self.log_variance = nn.Linear(16, latent_dim)
        self.decoder = nn.Sequential(nn.Linear(latent_dim, 16), nn.ReLU(), nn.Linear(16, 32), nn.ReLU(), nn.Linear(32, 2))

    def encode(self, values):
        hidden = self.encoder(values)
        return self.mean(hidden), self.log_variance(hidden).clamp(-8, 8)

    def reparameterize(self, mean, log_variance):
        standard_deviation = torch.exp(0.5 * log_variance)
        return mean + torch.randn_like(standard_deviation) * standard_deviation

    def forward(self, values):
        mean, log_variance = self.encode(values)
        latent = self.reparameterize(mean, log_variance)
        return self.decoder(latent), mean, log_variance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--samples", type=int, default=500)
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--output", default="nexus-vae-samples.csv")
    args = parser.parse_args()
    if not 1 <= args.epochs <= 300 or not 50 <= args.samples <= 10000:
        raise SystemExit("Use 1..300 epochs and 50..10000 generated samples.")

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(1)
    dataset = TensorDataset(make_synthetic_data(3000, args.seed))
    loader = DataLoader(dataset, batch_size=128, shuffle=True, generator=torch.Generator().manual_seed(args.seed))
    model = VAE()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    model.train()
    for epoch in range(args.epochs):
        total_loss = 0.0
        for (batch,) in loader:
            reconstruction, mean, log_variance = model(batch)
            reconstruction_loss = nn.functional.mse_loss(reconstruction, batch, reduction="sum")
            kl_loss = -0.5 * torch.sum(1 + log_variance - mean.pow(2) - log_variance.exp())
            loss = reconstruction_loss + 0.1 * kl_loss
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"epoch={epoch + 1:03d} loss={total_loss / len(dataset):.5f}")

    model.eval()
    with torch.no_grad():
        generated = model.decoder(torch.randn(args.samples, 2)).cpu().tolist()
    with open(args.output, "w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["x", "y"])
        writer.writerows([[f"{x:.6f}", f"{y:.6f}"] for x, y in generated])
    print(f"Generated {len(generated)} synthetic samples -> {args.output}")
    print("Research demo only: synthetic data, no production model update.")


if __name__ == "__main__":
    main()
