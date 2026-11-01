# NEXUS KAF-AI VAE research demo

This optional local experiment trains a small Variational Autoencoder (VAE) on a synthetic 2D dataset generated in the script. It demonstrates the training loop and sampling process without using real NEXUS user data.

## Run locally (CPU)

```bash
python -m pip install -r research/requirements.txt
python research/vae_toy.py --epochs 40 --samples 500 --output /tmp/nexus-vae-samples.csv
```

The output is a CSV of generated 2D points. This is a toy research baseline, not a production language model and not connected to the Workers AI chat endpoint. It does not train on user conversations, upload data, or update production settings. Review training loss and generated samples before drawing conclusions.
