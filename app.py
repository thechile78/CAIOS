"""CAIOS command-line entry point.

Chile AI Operating System v0.1 Alpha
"""

from scripts.show_prep import generate_show_prep


def main() -> None:
    """Run the CAIOS command-line menu."""
    print("==============================")
    print("        CHILE AI OS")
    print("==============================")
    print("1. Prepare Today's Show")
    print("2. Exit")

    choice = input("\nSelect an option: ").strip()

    if choice == "1":
        output_path = generate_show_prep()
        print(f"\nShow prep packet created: {output_path}")
    else:
        print("Exiting CAIOS.")


if __name__ == "__main__":
    main()
