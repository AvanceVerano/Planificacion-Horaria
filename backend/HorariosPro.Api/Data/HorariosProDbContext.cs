using HorariosPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Data;

public class HorariosProDbContext : DbContext
{
    public HorariosProDbContext(DbContextOptions<HorariosProDbContext> options)
        : base(options)
    {
    }

    public DbSet<Curso> Cursos => Set<Curso>();
    public DbSet<Seccion> Secciones => Set<Seccion>();
    public DbSet<Sesion> Sesiones => Set<Sesion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Curso>(entity =>
        {
            entity.Property(curso => curso.Nombre)
                .IsRequired()
                .HasMaxLength(200);
        });

        modelBuilder.Entity<Seccion>(entity =>
        {
            entity.Property(seccion => seccion.Codigo)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(seccion => seccion.Sede)
                .IsRequired()
                .HasMaxLength(120);

            entity.Property(seccion => seccion.Profesor)
                .IsRequired()
                .HasMaxLength(200);

            entity.HasOne(seccion => seccion.Curso)
                .WithMany(curso => curso.Secciones)
                .HasForeignKey(seccion => seccion.CursoId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Sesion>(entity =>
        {
            entity.Property(sesion => sesion.Dia)
                .IsRequired()
                .HasMaxLength(12);

            entity.Property(sesion => sesion.HoraInicio)
                .IsRequired();

            entity.Property(sesion => sesion.HoraFin)
                .IsRequired();

            entity.HasOne(sesion => sesion.Seccion)
                .WithMany(seccion => seccion.Sesiones)
                .HasForeignKey(sesion => sesion.SeccionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
