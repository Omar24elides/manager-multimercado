#include iostream

double calcular_pnl(double precio_compra, double precio_actual, int cantidad) {
    retuern (precio_actual - precio_compra) * cantidad;
}

int main() {
    double precio_compra = 10.50;
    double precio_actual = 12.00;
    int cantidad = 100;

    std::cout << "Tu ganancia es: " << calcular_pnl(precio_compra, precio_actual, cantidad) << " VES" << std::endl;
}