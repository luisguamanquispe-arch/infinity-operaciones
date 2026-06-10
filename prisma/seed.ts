import {
  PrismaClient,
  Rol,
  EstadoTecnico,
  TipoTrabajo,
  Prioridad,
  EstadoTicket,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.eventoTicket.deleteMany();
  await prisma.materialUtilizado.deleteMany();
  await prisma.fotografia.deleteMany();
  await prisma.firma.deleteMany();
  await prisma.medicion.deleteMany();
  await prisma.cronometro.deleteMany();
  await prisma.ordenServicio.deleteMany();
  await prisma.ubicacionGps.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.inventario.deleteMany();
  await prisma.evaluacionCliente.deleteMany();
  await prisma.tecnico.deleteMany();
  await prisma.usuario.deleteMany();

  const hash = await bcrypt.hash("tecnico123", 10);
  const hashSup = await bcrypt.hash("super123", 10);
  const hashAdmin = await bcrypt.hash("admin123", 10);

  const juan = await prisma.usuario.create({
    data: {
      email: "juan@infinity.ec",
      passwordHash: hash,
      nombre: "Juan Pérez",
      rol: Rol.TECNICO,
      tecnico: {
        create: {
          telefono: "0991234567",
          vehiculo: "Moto-01",
          estadoActual: EstadoTecnico.DISPONIBLE,
          lat: -1.2491,
          lng: -78.6168,
        },
      },
    },
    include: { tecnico: true },
  });

  const carlos = await prisma.usuario.create({
    data: {
      email: "carlos@infinity.ec",
      passwordHash: hash,
      nombre: "Carlos Mendoza",
      rol: Rol.TECNICO,
      tecnico: {
        create: {
          telefono: "0997654321",
          vehiculo: "Camioneta-02",
          estadoActual: EstadoTecnico.TRABAJANDO,
          lat: -1.255,
          lng: -78.62,
        },
      },
    },
    include: { tecnico: true },
  });

  await prisma.usuario.create({
    data: {
      email: "supervisor@infinity.ec",
      passwordHash: hashSup,
      nombre: "Ana Supervisor",
      rol: Rol.SUPERVISOR,
    },
  });

  await prisma.usuario.create({
    data: {
      email: "admin@infinity.ec",
      passwordHash: hashAdmin,
      nombre: "Gerencia Infinity",
      rol: Rol.ADMIN,
    },
  });

  const clientes = await Promise.all([
    prisma.cliente.create({
      data: {
        cedula: "0102030405",
        nombre: "María López",
        telefono: "0987654321",
        plan: "500 Mbps Fibra",
        direccion: "Av. Cevallos y Maldonado",
        sector: "Ficoa",
        lat: -1.252,
        lng: -78.619,
        nodo: "NODO-FICOA-01",
        cajaNap: "NAP-F-12",
        puerto: "P3",
        onuSerial: "HWTC-001234",
        potencia: -22,
      },
    }),
    prisma.cliente.create({
      data: {
        cedula: "0912345678",
        nombre: "Pedro Ramírez",
        telefono: "0976543210",
        plan: "300 Mbps Fibra",
        direccion: "Calle Sucre 123",
        sector: "Ambato Sur",
        lat: -1.258,
        lng: -78.625,
        nodo: "NODO-AS-03",
        cajaNap: "NAP-AS-08",
        puerto: "P1",
      },
    }),
    prisma.cliente.create({
      data: {
        cedula: "1723456789",
        nombre: "Lucía Torres",
        telefono: "0965432109",
        plan: "200 Mbps Fibra",
        direccion: "Av. Unidad Nacional",
        sector: "Huachi",
        lat: -1.245,
        lng: -78.61,
        nodo: "NODO-HU-02",
        cajaNap: "NAP-HU-05",
        puerto: "P2",
      },
    }),
    prisma.cliente.create({
      data: {
        cedula: "1109876543",
        nombre: "Roberto Vega",
        telefono: "0954321098",
        plan: "1 Gbps Fibra",
        direccion: "La Matriz",
        sector: "Centro",
        lat: -1.241,
        lng: -78.614,
        nodo: "NODO-CE-01",
        cajaNap: "NAP-CE-03",
        puerto: "P4",
      },
    }),
  ]);

  await prisma.inventario.createMany({
    data: [
      { nombre: "Cable Drop", unidad: "m", stock: 5000, stockMin: 500 },
      { nombre: "Conector SC/APC", unidad: "unidad", stock: 200, stockMin: 20 },
      { nombre: "ONU Huawei", unidad: "unidad", stock: 50, stockMin: 10 },
      { nombre: "Router WiFi", unidad: "unidad", stock: 30, stockMin: 5 },
      { nombre: "Patch Cord", unidad: "unidad", stock: 100, stockMin: 15 },
    ],
  });

  const now = new Date();
  const sla4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const sla8h = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const ticketsData = [
    {
      codigo: "ST-1001",
      clienteId: clientes[1].id,
      tecnicoId: juan.tecnico!.id,
      tipo: TipoTrabajo.SOPORTE,
      prioridad: Prioridad.ALTA,
      estado: EstadoTicket.PENDIENTE,
      motivo: "Sin servicio",
      descripcion: "Cliente reporta luz roja en ONU",
      slaHoras: 4,
      slaVenceEn: sla4h,
    },
    {
      codigo: "ST-1002",
      clienteId: clientes[0].id,
      tecnicoId: juan.tecnico!.id,
      tipo: TipoTrabajo.INSTALACION,
      prioridad: Prioridad.MEDIA,
      estado: EstadoTicket.EN_PROCESO,
      motivo: "Nueva instalación",
      descripcion: "Instalación fibra 500 Mbps",
      slaHoras: 8,
      slaVenceEn: sla8h,
    },
    {
      codigo: "ST-1003",
      clienteId: clientes[2].id,
      tecnicoId: juan.tecnico!.id,
      tipo: TipoTrabajo.RECONEXION,
      prioridad: Prioridad.MEDIA,
      estado: EstadoTicket.PENDIENTE,
      motivo: "Reconexión por pago",
      descripcion: "Cliente pagó mora, reconectar servicio",
      slaHoras: 8,
      slaVenceEn: sla8h,
    },
    {
      codigo: "ST-1004",
      clienteId: clientes[3].id,
      tecnicoId: carlos.tecnico!.id,
      tipo: TipoTrabajo.SOPORTE,
      prioridad: Prioridad.BAJA,
      estado: EstadoTicket.EN_PROCESO,
      motivo: "Lentitud",
      descripcion: "Velocidad inferior al plan contratado",
      slaHoras: 24,
      slaVenceEn: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
    {
      codigo: "ST-1005",
      clienteId: clientes[0].id,
      tecnicoId: juan.tecnico!.id,
      tipo: TipoTrabajo.SOPORTE,
      prioridad: Prioridad.MEDIA,
      estado: EstadoTicket.CERRADO,
      motivo: "Intermitencia",
      descripcion: "Servicio intermitente resuelto",
      slaHoras: 8,
      slaVenceEn: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  ];

  for (const t of ticketsData) {
    const ticket = await prisma.ticket.create({ data: t });

    if (t.estado === EstadoTicket.EN_PROCESO) {
      await prisma.ordenServicio.create({
        data: {
          ticketId: ticket.id,
          iniciadoEn: new Date(now.getTime() - 45 * 60 * 1000),
          latInicio: -1.2491,
          lngInicio: -78.6168,
          cronometro: {
            create: {
              inicio: new Date(now.getTime() - 45 * 60 * 1000),
              activo: true,
              duracionSegundos: 45 * 60,
            },
          },
        },
      });
    }

    if (t.estado === EstadoTicket.CERRADO) {
      await prisma.ordenServicio.create({
        data: {
          ticketId: ticket.id,
          iniciadoEn: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          finalizadoEn: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          servicioOk: true,
          potenciaOk: true,
          fotosOk: true,
          clienteConforme: true,
          firmaOk: true,
          whatsappEnviado: true,
          cronometro: {
            create: {
              inicio: new Date(now.getTime() - 3 * 60 * 60 * 1000),
              fin: new Date(now.getTime() - 2 * 60 * 60 * 1000),
              duracionSegundos: 3600,
            },
          },
          medicion: {
            create: {
              rxDbm: -22,
              txDbm: 2,
              pingMs: 5,
              downloadMbps: 540,
              uploadMbps: 550,
            },
          },
        },
      });
    }
  }

  console.log("✅ Seed completado");
  console.log("   Técnico:    juan@infinity.ec / tecnico123");
  console.log("   Supervisor: supervisor@infinity.ec / super123");
  console.log("   Admin:      admin@infinity.ec / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
